import ExcelJS from 'exceljs';
import { pool } from '../config/database';

export async function buildExportWorkbook(roundId: number): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '作文評価システム';

  // Get round info
  const { rows: roundRows } = await pool.query('SELECT * FROM evaluation_rounds WHERE id = $1', [roundId]);
  const round = roundRows[0];

  // Get rubric for 2nd phase criteria names
  let secondCriteria: any[] = [];
  try {
    const { rows: rubricRows } = await pool.query(
      `SELECT r.criteria FROM rubrics r
       JOIN round_rubrics rr ON rr.rubric_id = r.id
       WHERE rr.round_id = $1 AND rr.phase = 'second'`,
      [roundId]
    );
    if (rubricRows.length > 0 && Array.isArray(rubricRows[0].criteria)) {
      secondCriteria = rubricRows[0].criteria;
    }
  } catch {
    // No rubric assigned for this round's 2nd phase - continue with empty criteria
  }

  // Sheet 1: 1st Phase Results
  const sheet1 = workbook.addWorksheet('1次採点結果');
  sheet1.columns = [
    { header: '受付番号', key: 'receipt_number', width: 15 },
    { header: '生徒番号', key: 'student_number', width: 15 },
    { header: '元PDFファイル名', key: 'original_filename', width: 30 },
    { header: '採点者ID', key: 'evaluator_login_id', width: 12 },
    { header: '採点者', key: 'evaluator_name', width: 15 },
    { header: 'スコア', key: 'score', width: 10 },
    { header: '所見', key: 'summary', width: 40 },
    { header: '採点日時', key: 'submitted_at', width: 20 },
  ];

  const { rows: firstScores } = await pool.query(
    `SELECT e.receipt_number, s.student_number, u.login_id as evaluator_login_id, u.display_name as evaluator_name,
            s.score, s.summary, s.submitted_at,
            up.original_filename
     FROM scores s
     JOIN essays e ON e.id = s.essay_id
     JOIN users u ON u.id = s.user_id
     LEFT JOIN uploaded_pdfs up ON up.id = e.original_pdf_id
     WHERE s.round_id = $1 AND s.phase = 'first' AND s.is_draft = false
     ORDER BY e.receipt_number`,
    [roundId]
  );
  firstScores.forEach((row) => sheet1.addRow(row));
  styleHeader(sheet1);

  // Sheet 2: 2nd Phase Results
  const sheet2 = workbook.addWorksheet('2次採点結果');
  const sheet2Columns: Partial<ExcelJS.Column>[] = [
    { header: '受付番号', key: 'receipt_number', width: 15 },
    { header: '生徒番号', key: 'student_number', width: 15 },
    { header: '元PDFファイル名', key: 'original_filename', width: 30 },
  ];

  // Add dynamic criteria columns for each evaluator
  for (let evalIdx = 1; evalIdx <= (round.second_evaluator_count || 1); evalIdx++) {
    sheet2Columns.push({ header: `採点者ID${evalIdx}`, key: `eval${evalIdx}_login_id`, width: 12 });
    sheet2Columns.push({ header: `採点者${evalIdx}`, key: `eval${evalIdx}_name`, width: 15 });
    for (const criterion of secondCriteria) {
      sheet2Columns.push({ header: `${criterion.name}(${evalIdx})`, key: `eval${evalIdx}_${criterion.name}`, width: 12 });
    }
    sheet2Columns.push({ header: `合計${evalIdx}`, key: `eval${evalIdx}_total`, width: 10 });
  }
  sheet2Columns.push({ header: '平均点', key: 'average', width: 10 });
  sheet2.columns = sheet2Columns;

  const { rows: secondScores } = await pool.query(
    `SELECT e.receipt_number, e.student_number, e.second_phase_avg,
            s.user_id, u.display_name as evaluator_name, u.login_id as evaluator_login_id,
            s.criteria_scores, s.total_score,
            up.original_filename
     FROM essays e
     JOIN scores s ON s.essay_id = e.id AND s.phase = 'second' AND s.is_draft = false
     JOIN users u ON u.id = s.user_id
     LEFT JOIN uploaded_pdfs up ON up.id = e.original_pdf_id
     WHERE e.round_id = $1 AND e.second_phase_avg IS NOT NULL
     ORDER BY e.receipt_number, s.user_id`,
    [roundId]
  );

  // Group by essay
  const essayMap = new Map<string, any>();
  for (const row of secondScores) {
    if (!essayMap.has(row.receipt_number)) {
      essayMap.set(row.receipt_number, {
        receipt_number: row.receipt_number,
        student_number: row.student_number,
        original_filename: row.original_filename,
        average: row.second_phase_avg,
        evaluators: [],
      });
    }
    essayMap.get(row.receipt_number)!.evaluators.push(row);
  }

  for (const [, essay] of essayMap) {
    const rowData: any = {
      receipt_number: essay.receipt_number,
      student_number: essay.student_number,
      original_filename: essay.original_filename,
      average: essay.average,
    };
    essay.evaluators.forEach((ev: any, idx: number) => {
      const evalIdx = idx + 1;
      rowData[`eval${evalIdx}_login_id`] = ev.evaluator_login_id;
      rowData[`eval${evalIdx}_name`] = ev.evaluator_name;
      if (ev.criteria_scores) {
        for (const cs of ev.criteria_scores) {
          rowData[`eval${evalIdx}_${cs.criterion}`] = cs.score;
        }
      }
      rowData[`eval${evalIdx}_total`] = ev.total_score;
    });
    sheet2.addRow(rowData);
  }
  styleHeader(sheet2);

  // Sheet 3: Rankings
  const sheet3 = workbook.addWorksheet('ランキング');
  sheet3.columns = [
    { header: '順位', key: 'rank', width: 8 },
    { header: '受付番号', key: 'receipt_number', width: 15 },
    { header: '生徒番号', key: 'student_number', width: 15 },
    { header: '元PDFファイル名', key: 'original_filename', width: 30 },
    { header: '1次スコア', key: 'first_phase_score', width: 12 },
    { header: '2次平均', key: 'second_phase_avg', width: 12 },
  ];

  const { rows: rankings } = await pool.query(
    `SELECT e.receipt_number, e.student_number, e.first_phase_score, e.second_phase_avg,
            up.original_filename,
            RANK() OVER (ORDER BY COALESCE(e.second_phase_avg, e.first_phase_score) DESC NULLS LAST) as rank
     FROM essays e
     LEFT JOIN uploaded_pdfs up ON up.id = e.original_pdf_id
     WHERE e.round_id = $1 AND e.first_phase_score IS NOT NULL
     ORDER BY rank`,
    [roundId]
  );
  rankings.forEach((row) => sheet3.addRow(row));
  styleHeader(sheet3);

  // Sheet 4: Evaluator Summary
  const sheet4 = workbook.addWorksheet('採点者集計');
  sheet4.columns = [
    { header: 'ログインID', key: 'login_id', width: 15 },
    { header: '採点者名', key: 'display_name', width: 15 },
    { header: '1次担当数', key: 'first_assigned', width: 12 },
    { header: '1次完了数', key: 'first_completed', width: 12 },
    { header: '2次担当数', key: 'second_assigned', width: 12 },
    { header: '2次完了数', key: 'second_completed', width: 12 },
  ];

  const { rows: evaluatorStats } = await pool.query(
    `SELECT u.login_id, u.display_name,
       COUNT(a.id) FILTER (WHERE a.phase = 'first') as first_assigned,
       COUNT(a.id) FILTER (WHERE a.phase = 'first' AND a.status = 'completed') as first_completed,
       COUNT(a.id) FILTER (WHERE a.phase = 'second') as second_assigned,
       COUNT(a.id) FILTER (WHERE a.phase = 'second' AND a.status = 'completed') as second_completed
     FROM users u
     LEFT JOIN assignments a ON a.user_id = u.id AND a.round_id = $1
     WHERE u.role IN ('evaluator', 'leader') AND u.is_active = true
     GROUP BY u.id, u.login_id, u.display_name
     ORDER BY u.display_name`,
    [roundId]
  );
  evaluatorStats.forEach((row) => sheet4.addRow(row));
  styleHeader(sheet4);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function styleHeader(sheet: ExcelJS.Worksheet) {
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8E8E8' },
  };
  headerRow.border = {
    bottom: { style: 'thin' },
  };
}
