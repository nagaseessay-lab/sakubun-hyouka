-- Seed the default first-phase rubric template (5-level scoring 0-4)
INSERT INTO rubrics (name, phase, criteria, is_template, created_by)
SELECT
  '1周目基本テンプレート（5段階 0〜4）',
  'first',
  '[{"name":"総合評価","description":"0: 1200字未満（字数不足は自動0点）\n1: 字数充足だが内容不十分\n2: 基本的な構成・内容あり\n3: 良好な構成・内容・表現\n4: 特に優秀（50枚中1枚程度の割合）","score_min":0,"score_max":4,"weight":1}]'::jsonb,
  true,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM rubrics WHERE name = '1周目基本テンプレート（5段階 0〜4）' AND is_template = true
);
