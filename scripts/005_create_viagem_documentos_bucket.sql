-- Storage bucket para documentos de viagem

INSERT INTO storage.buckets (id, name, public)
VALUES ('viagem-documentos', 'viagem-documentos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso por usuário (baseadas no prefixo do caminho: {user_id}/...)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'viagem_documentos_storage_select'
  ) THEN
    CREATE POLICY "viagem_documentos_storage_select"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (bucket_id = 'viagem-documentos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'viagem_documentos_storage_insert'
  ) THEN
    CREATE POLICY "viagem_documentos_storage_insert"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'viagem-documentos'
      AND split_part(name, '/', 1) = auth.uid()::text
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'viagem_documentos_storage_update'
  ) THEN
    CREATE POLICY "viagem_documentos_storage_update"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'viagem-documentos'
      AND split_part(name, '/', 1) = auth.uid()::text
    )
    WITH CHECK (
      bucket_id = 'viagem-documentos'
      AND split_part(name, '/', 1) = auth.uid()::text
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'viagem_documentos_storage_delete'
  ) THEN
    CREATE POLICY "viagem_documentos_storage_delete"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'viagem-documentos'
      AND split_part(name, '/', 1) = auth.uid()::text
    );
  END IF;
END
$$;
