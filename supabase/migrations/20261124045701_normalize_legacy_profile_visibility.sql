-- Canonicalise the legacy connections-only profile setting without making profiles public.
CREATE FUNCTION public.normalize_legacy_profile_visibility()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.profile_visibility = 'connections' THEN
    NEW.profile_visibility := 'private';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.normalize_legacy_profile_visibility() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER profiles_normalize_legacy_visibility
BEFORE INSERT OR UPDATE OF profile_visibility ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.normalize_legacy_profile_visibility();
UPDATE public.profiles SET profile_visibility = 'private' WHERE profile_visibility = 'connections';
ALTER TABLE public.profiles DROP CONSTRAINT profiles_profile_visibility_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_profile_visibility_check CHECK (profile_visibility IN ('public','private'));
