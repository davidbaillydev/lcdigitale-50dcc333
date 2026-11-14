import { useState, type FormEvent } from "react";
import { Bot, LifeBuoy, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Message = { id: string; role: "assistant" | "user"; content: string };

const WELCOME =
  "Bonjour ! Je suis l’assistant LC Digitale. Je peux vous aider à comprendre le fonctionnement de votre espace, préparer un diagnostic ou transmettre un incident à notre équipe. Je ne réalise pas encore de modification sur vos commandes, vos paiements ou votre carte.";

const SUGGESTIONS = [
  "Je rencontre un problème avec mon imprimante",
  "Une commande n’apparaît pas en cuisine",
  "Comment modifier ma carte ?",
];

function localSupportReply(question: string) {
  const q = question.toLocaleLowerCase("fr");
  if (q.includes("imprim") || q.includes("ticket")) {
    return "Pour commencer le diagnostic : vérifiez que l’imprimante est allumée, alimentée en papier et connectée au même réseau ou appareil que votre écran cuisine. Dans l’écran cuisine, ouvrez « Réglages et sections », puis « Imprimante » pour vérifier le périphérique et lancer un test. Si le test échoue, indiquez-moi le modèle de l’imprimante et son mode de connexion (Bluetooth, USB ou réseau).";
  }
  if (q.includes("commande") || q.includes("cuisine") || q.includes("kds")) {
    return "Une commande payée ou validée doit apparaître dans l’écran cuisine du restaurant concerné. Vérifiez d’abord que le bon restaurant est sélectionné et que l’écran cuisine est connecté. Le bandeau « Mode hors-ligne » ou « Reconnexion en cours » indique une perte de connexion : les commandes existantes restent visibles et les changements sont synchronisés au retour du réseau. Donnez-moi le numéro de commande et ce que vous voyez à l’écran ; ne partagez aucune donnée bancaire.";
  }
  if (q.includes("carte") || q.includes("menu") || q.includes("prix") || q.includes("plat")) {
    return "Pour modifier votre carte, ouvrez l’espace de votre restaurant puis « Carte ». Vous pourrez éditer les catégories, les plats, les descriptions et les prix, puis enregistrer pour publier les changements. Les modifications de carte sont réservées au gérant et à l’agence. Je peux vous guider, mais je n’applique pas encore les changements à votre place.";
  }
  if (q.includes("réserv") || q.includes("reservation")) {
    return "Les réservations sont accessibles depuis la rubrique « Réservations » lorsqu’elle est activée pour votre restaurant. Vérifiez que vous êtes connecté au bon établissement. Décrivez-moi le problème rencontré et je vous aiderai à identifier la prochaine vérification.";
  }
  return "Je peux vous accompagner sur les commandes, l’écran cuisine, les imprimantes, la carte et les réservations. Décrivez ce que vous essayez de faire, le message affiché et, si cela concerne une commande, son numéro uniquement. Pour l’instant, je fournis une première aide guidée ; les diagnostics connectés et la création de tickets seront ajoutés après configuration du service IA côté serveur.";
}

export function LcAiAssistant({ restaurantName }: { restaurantName: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([{ id: "welcome", role: "assistant", content: WELCOME }]);
  const [busy, setBusy] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = draft.trim();
    if (!question || busy) return;
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: question };
    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setBusy(true);
    // Interface de première version : aucune action sur les commandes ou les données du restaurant.
    window.setTimeout(() => {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: localSupportReply(question) }]);
      setBusy(false);
    }, 250);
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 min-h-12 rounded-full px-4 shadow-lg"
        aria-label="Ouvrir l’assistant LC Digitale"
      >
        <Bot className="mr-2 h-5 w-5" /> Assistant LC
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex h-[100dvh] w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border px-5 pb-4 pr-12 pt-6 text-left">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Bot className="h-6 w-6" /></span>
              <div className="min-w-0">
                <SheetTitle>Assistant LC Digitale</SheetTitle>
                <SheetDescription className="truncate">{restaurantName} · Support restaurateur</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5" aria-live="polite">
            <div className="flex items-start gap-2 text-xs text-muted-foreground"><LifeBuoy className="h-4 w-4 shrink-0" /> Première version · aide guidée</div>
            {messages.map((message) => (
              <div key={message.id} className={cn("max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed", message.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "mr-auto border border-border bg-card text-card-foreground")}>
                {message.content}
              </div>
            ))}
            {busy && <p className="text-sm text-muted-foreground">Préparation de la réponse…</p>}
            {messages.length === 1 && (
              <div className="space-y-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button key={suggestion} type="button" onClick={() => setDraft(suggestion)} className="block w-full rounded-xl border border-border px-3 py-3 text-left text-sm hover:bg-accent">
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
          <form onSubmit={submit} className="border-t border-border bg-background p-4">
            <div className="flex items-end gap-2">
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Décrivez votre problème…"
                rows={2}
                maxLength={2000}
                className="max-h-32 min-h-12 resize-y"
                aria-label="Votre message à l’assistant"
              />
              <Button type="submit" size="icon" className="h-12 w-12 shrink-0" disabled={!draft.trim() || busy} aria-label="Envoyer le message">
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Ne partagez pas de mot de passe ni de donnée bancaire.</p>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
