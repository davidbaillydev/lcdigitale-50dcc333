import { useId, useState } from "react";
import { Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { buildWhatsAppOnboarding, normalizeWhatsAppPhone, whatsappUrl, type WhatsAppRestaurant } from "@/lib/whatsapp-access";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function WhatsAppAccess({ restaurant, compact = false }: { restaurant: WhatsAppRestaurant; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const id = useId();
  const digits = normalizeWhatsAppPhone(phone);
  const invalidPhone = phone.trim() !== "" && !/^[1-9]\d{6,14}$/.test(digits);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Message copié");
    } catch {
      toast.error("Copie indisponible : sélectionnez le message pour le copier.");
    }
  };

  return (
    <>
      <Button size={compact ? "sm" : "default"} variant="secondary" onClick={() => {
        setPhone(restaurant.phone ?? "");
        setMessage(buildWhatsAppOnboarding(restaurant));
        setOpen(true);
      }}><MessageCircle /> Accès WhatsApp</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader className="pr-8">
            <DialogTitle className="text-2xl">Accès WhatsApp — {restaurant.name}</DialogTitle>
            <DialogDescription>Message d’accueil · /{restaurant.slug}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`${id}-phone`}>Numéro WhatsApp</Label>
            <Input id={`${id}-phone`} type="tel" autoComplete="tel" placeholder="+33 6 12 34 56 78" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={invalidPhone} aria-describedby={`${id}-phone-help`} />
            <p id={`${id}-phone-help`} className={invalidPhone ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
              {invalidPhone ? "Saisissez un numéro valide avec son indicatif international, ou laissez le champ vide." : "Sans numéro, choisissez le destinataire dans WhatsApp. Pour l’étranger, indiquez l’indicatif international."}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-message`}>Message</Label>
            <Textarea id={`${id}-message`} className="h-[min(46dvh,28rem)] min-h-48 resize-y text-sm leading-relaxed" value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <DialogFooter className="sticky bottom-0 gap-2 border-t border-border bg-background pt-4">
            <Button variant="outline" className="min-h-12" disabled={!message.trim()} onClick={copy}><Copy /> Copier le message</Button>
            {invalidPhone || !message.trim()
              ? <Button className="min-h-12" disabled><MessageCircle /> Ouvrir WhatsApp</Button>
              : <Button asChild className="min-h-12"><a href={whatsappUrl(phone, message)} target="_blank" rel="noopener noreferrer"><MessageCircle /> Ouvrir WhatsApp</a></Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}