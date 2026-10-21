import { createContext, useContext, useState, type ReactNode } from "react";
import { Clock3, CreditCard, Image, Megaphone, Plug, ShieldCheck, Truck } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const GROUPS = [
  ["service", "Horaires & commandes", Clock3],
  ["delivery", "Livraison", Truck],
  ["payments", "Paiements", CreditCard],
  ["communication", "Relation client", Megaphone],
  ["appearance", "Identité & tickets", Image],
  ["integrations", "Assistants & connexions", Plug],
  ["agency", "Modules & juridique", ShieldCheck],
] as const;
export type SettingsGroupKey = (typeof GROUPS)[number][0];
const SettingsContext = createContext<SettingsGroupKey>("service");
export function useSettingsGroup() { return useContext(SettingsContext); }

export function SettingsGroup({ name, children }: { name: SettingsGroupKey; children: ReactNode }) {
  const active = useSettingsGroup();
  return <div hidden={active !== name} className="min-w-0 space-y-6" role="tabpanel" id={`settings-panel-${name}`} aria-labelledby={`settings-tab-${name}`}>{children}</div>;
}

export function SettingsWorkspace({ agency = false, children }: { agency?: boolean; children: ReactNode }) {
  const [active, setActive] = useState<SettingsGroupKey>("service");
  return (
    <SettingsContext.Provider value={active}>
      <div className="settings-workspace min-w-0 space-y-6">
        <Tabs value={active} onValueChange={(value) => { if (GROUPS.some(([key]) => key === value)) setActive(value as SettingsGroupKey); }}>
          <TabsList aria-label="Sections des réglages" className="grid h-auto w-full grid-cols-2 gap-1 rounded-lg border border-border bg-muted p-1 sm:grid-cols-3">
            {GROUPS.filter(([key]) => agency || (key !== "agency" && key !== "appearance")).map(([key, label, Icon]) => (
              <TabsTrigger key={key} value={key} id={`settings-tab-${key}`} aria-controls={`settings-panel-${key}`} className="min-h-12 min-w-0 justify-start gap-2 whitespace-normal px-3 py-3 text-left">
                <Icon aria-hidden="true" className="h-4 w-4 shrink-0" /><span>{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {children}
      </div>
    </SettingsContext.Provider>
  );
}