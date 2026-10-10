DROP TRIGGER IF EXISTS on_auth_user_created_first_admin ON auth.users;
DROP FUNCTION IF EXISTS public.handle_first_user();