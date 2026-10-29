import { useId, useState } from "react";
import { Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { buildWhatsAppOnboarding, deliveryRateLabels, serviceFeeRateLabel, whatsappMessageParts, normalizeWhatsAppPhone, whatsappUrl, type WhatsAppRestaurant } from "@/lib/whatsapp-access";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export function WhatsAppAccess({ restaurant, compact = false, origin }: { restaurant: WhatsAppRestaurant; compact?: boolean; origin?: string | null }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [view, setView] = useState("preview");
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
        setMessage(buildWhatsAppOnboarding(restaurant, origin));
        setView("preview");
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
          <section className="space-y-2" aria-label="Tarifs configurés">
            <h3 className="text-sm font-semibold">Tarifs configurés</h3>
            <div className="flex flex-wrap gap-2">
              {(deliveryRateLabels(restaurant.delivery).length ? deliveryRateLabels(restaurant.delivery) : ["Livraison : tarifs non renseignés"]).map((label) => <Badge key={label} variant="secondary" className="h-auto max-w-full whitespace-normal break-words rounded-md px-3 py-2 text-left leading-relaxed">{label}</Badge>)}
              <Badge variant="outline" className="h-auto max-w-full whitespace-normal break-words rounded-md px-3 py-2 text-left leading-relaxed">{serviceFeeRateLabel(restaurant.config.serviceFee)}</Badge>
            </div>
          </section>
          <Tabs value={view} onValueChange={setView}>
            <TabsList className="h-auto w-full">
              <TabsTrigger value="preview" className="min-h-12 flex-1">Aperçu du message</TabsTrigger>
              <TabsTrigger value="edit" className="min-h-12 flex-1">Modifier le texte</TabsTrigger>
            </TabsList>
            <TabsContent value="preview">
              <div role="region" aria-label="Aperçu du message" className="h-[min(42dvh,28rem)] min-h-48 overflow-y-auto overscroll-contain rounded-lg border border-border bg-muted/50 p-4">
                <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {whatsappMessageParts(message).map((part, index) => part.href
                    ? <a key={index} href={part.href} target="_blank" rel="noopener noreferrer" className="break-all text-primary underline underline-offset-2">{part.text}</a>
                    : <span key={index}>{part.text}</span>)}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="edit" className="space-y-2">
              <Label htmlFor={`${id}-message`}>Message</Label>
              <Textarea id={`${id}-message`} className="h-[min(42dvh,28rem)] min-h-48 resize-y text-sm leading-relaxed" value={message} onChange={(e) => setMessage(e.target.value)} />
            </TabsContent>
          </Tabs>
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