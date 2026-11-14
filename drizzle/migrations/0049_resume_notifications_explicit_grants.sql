REVOKE ALL ON public.restaurant_availability_notifications FROM anon,authenticated;
GRANT SELECT ON public.restaurant_availability_notifications TO authenticated;
GRANT ALL ON public.restaurant_availability_notifications TO service_role;
REVOKE ALL ON FUNCTION public.consume_availability_notifications() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.consume_availability_notifications() TO authenticated;