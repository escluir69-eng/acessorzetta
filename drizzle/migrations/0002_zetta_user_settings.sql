CREATE TABLE public.user_settings (
 user_id uuid PRIMARY KEY DEFAULT auth.uid(),
 full_name text NOT NULL DEFAULT '', preferred_name text NOT NULL DEFAULT '', document text NOT NULL DEFAULT '', whatsapp text NOT NULL DEFAULT '',
 alexa_linked boolean NOT NULL DEFAULT false, avatar_url text NOT NULL DEFAULT '', theme text NOT NULL DEFAULT 'system' CHECK (theme IN ('light','dark','system')), accent_color text NOT NULL DEFAULT '#0C1928',
 pluggy_auto_sync boolean NOT NULL DEFAULT false,
 pix_key_type text NOT NULL DEFAULT 'EMAIL' CHECK (pix_key_type IN ('CPF','CNPJ','EMAIL','PHONE','RANDOM')), pix_key text NOT NULL DEFAULT '', pix_merchant_name varchar(25) NOT NULL DEFAULT '', pix_merchant_city varchar(15) NOT NULL DEFAULT '', pix_txid_prefix varchar(20) NOT NULL DEFAULT 'ZETTA',
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages Zetta preferences" ON public.user_settings FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE FUNCTION public.create_zetta_settings() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN INSERT INTO public.user_settings(user_id, full_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name','')) ON CONFLICT DO NOTHING; RETURN NEW; END; $$;
CREATE TRIGGER zetta_settings_on_signup AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_zetta_settings();
INSERT INTO public.user_settings(user_id,full_name) SELECT id, COALESCE(raw_user_meta_data->>'full_name','') FROM auth.users ON CONFLICT DO NOTHING;