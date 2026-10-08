ALTER TABLE public.orders DROP CONSTRAINT orders_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check CHECK (payment_status IN ('pending','paid','failed','expired','refunded','partially_refunded'));
ALTER TABLE public.orders ADD CONSTRAINT orders_refund_status_check CHECK (refund_status IN ('none','partial','full'));
ALTER TABLE public.restaurant_payment_providers DROP CONSTRAINT restaurant_payment_providers_provider_check;
ALTER TABLE public.restaurant_payment_providers ADD CONSTRAINT restaurant_payment_providers_provider_check CHECK (provider IN ('sumup','stripe','paypal','lyra','mollie'));