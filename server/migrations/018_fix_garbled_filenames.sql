-- Fix garbled Japanese filenames in uploaded_pdfs
-- These were stored before decodeFilename was added.
-- PostgreSQL convert_from/convert_to can reverse the latin1→UTF-8 corruption.

DO $$
DECLARE
  rec RECORD;
  fixed_name TEXT;
BEGIN
  FOR rec IN SELECT id, original_filename FROM uploaded_pdfs LOOP
    BEGIN
      -- Try to convert: if the filename was stored as UTF-8 bytes read as latin1,
      -- convert_to(text, 'LATIN1') reverses it, then convert_from(..., 'UTF8') restores it
      fixed_name := convert_from(convert_to(rec.original_filename, 'LATIN1'), 'UTF8');
      -- Only update if the result is different and contains CJK characters
      IF fixed_name IS DISTINCT FROM rec.original_filename
         AND fixed_name ~ '[\u3000-\u9fff]' THEN
        UPDATE uploaded_pdfs SET original_filename = fixed_name WHERE id = rec.id;
        RAISE NOTICE 'Fixed filename id=%: % -> %', rec.id, rec.original_filename, fixed_name;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Skip rows that can't be converted (already correct or different encoding)
      NULL;
    END;
  END LOOP;
END $$;
