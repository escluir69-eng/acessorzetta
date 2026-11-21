CREATE TABLE public.firestore_docs (
  path text PRIMARY KEY,
  user_id uuid NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX firestore_docs_user_path_idx ON public.firestore_docs (user_id, path text_pattern_ops);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.firestore_docs TO authenticated;
GRANT ALL ON public.firestore_docs TO service_role;
ALTER TABLE public.firestore_docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own docs" ON public.firestore_docs FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
ALTER PUBLICATION supabase_realtime ADD TABLE public.firestore_docs;