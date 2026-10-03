ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_mode_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_mode_check CHECK (mode in ('pickup','delivery','dine_in'));
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check CHECK (payment_method in ('online','on_site','counter','card_terminal'));
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web' CHECK (source in ('web','kiosk'));