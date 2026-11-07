import { describe,expect,it } from "vitest";
import {directDiscount,validatePosPayments,paymentRemaining,posMonthlyCsv,zReport,type ZReport} from "@/lib/pos-register";
import {vatBreakdown} from "@/lib/ticket-vat";
import {receiptOpensDrawer} from "@/lib/pos-print";
import {sampleOrder} from "@/lib/ticket";
describe("caisse avancée",()=>{
 it("entrées sorties modifient le tiroir théorique",()=>{const r=zReport([{total:27,status:"accepted",pos_tender:{method:"cash"},pos_payments:[{method:"cash",amount:10},{method:"card",amount:17}]}],50,75,[{kind:"in",amount:20,reason:"Appoint",at:"2026-11-07",createdBy:"test",orderId:null},{kind:"out",amount:5,reason:"Achat",at:"2026-11-07",createdBy:"test",orderId:null}]);expect(r.cashIn).toBe(20);expect(r.cashOut).toBe(5);expect(r.expectedCash).toBe(75);expect(r.cashDifference).toBe(0);});
 it("annulation conserve montant annulé et exclut vente du net",()=>{const r=zReport([{total:30,status:"cancelled",pos_tender:{method:"card"}},{total:27,status:"accepted",discount:3,pos_tender:{method:"cash"},pos_payments:[{method:"cash",amount:10},{method:"card",amount:17}]}],50,60);expect(r.cancelled).toBe(1);expect(r.cancelledAmount).toBe(30);expect(r.total).toBe(27);expect(r.byMethod.card.amount).toBe(17);expect(r.discountTotal).toBe(3);});
 it("fractionne 30 euros en 10 espèces et 20 CB avec rendu 10",()=>{const ps=validatePosPayments(30,[{method:"cash",amount:10,given:20},{method:"card",amount:20}]);expect(ps[0]?.change).toBe(10);expect(paymentRemaining(30,ps)).toBe(0);});
 it("affiche 20 restant après 10 euros espèces",()=>expect(paymentRemaining(30,[{method:"cash",amount:10}])).toBe(20));
 it("rejette sous-paiement et sur-paiement",()=>{expect(()=>validatePosPayments(30,[{method:"card",amount:20}])).toThrow();expect(()=>validatePosPayments(30,[{method:"card",amount:40}])).toThrow();});
 it("rejette les espèces remises insuffisantes",()=>expect(()=>validatePosPayments(30,[{method:"cash",amount:30,given:20}])).toThrow());
 it("les titres restaurant participent au fractionnement",()=>expect(validatePosPayments(30,[{method:"meal_voucher",amount:10},{method:"card",amount:20}])).toHaveLength(2));
 it("remise pourcentage de 10% sur 30 euros",()=>expect(directDiscount(30,{type:"percent",value:10,reason:"Fidélité"})).toBe(3));
 it("remise fixe de 5 euros",()=>expect(directDiscount(30,{type:"fixed",value:5,reason:"Geste commercial"})).toBe(5));
 it("motif obligatoire",()=>expect(()=>directDiscount(30,{type:"fixed",value:5,reason:""})).toThrow());
 it("refuse les remises au-delà du panier ou 100%",()=>{expect(()=>directDiscount(30,{type:"fixed",value:40,reason:"test"})).toThrow();expect(()=>directDiscount(30,{type:"percent",value:101,reason:"test"})).toThrow();});
 it("TVA figée des trois taux après remise : TTC égal total",()=>{const vat=vatBreakdown({items:[{total:10.55,vatRate:5.5},{total:11,vatRate:10},{total:12,vatRate:20}],total:30.195});expect(vat.map((v)=>v.rate)).toEqual([5.5,10,20]);expect(Math.round(vat.reduce((s,v)=>s+v.ttc,0)*100)/100).toBe(30.2);for(const v of vat)expect(Math.round((v.ht+v.vat)*100)/100).toBe(v.ttc);});
 it("le tiroir s'ouvre aussi si les espèces ne sont pas le premier règlement",()=>expect(receiptOpensDrawer({...sampleOrder(),source:"pos",payment_status:"paid",pos_tender:{method:"card"},pos_payments:[{method:"card",amount:20},{method:"cash",amount:10}]},false)).toBe(true));
 it("grand livre filtre par mois Paris et expose tous les taux",()=>{
 const r:ZReport={orders:1,cancelled:0,total:33.55,byMethod:{cash:{amount:10,count:1},card:{amount:23.55,count:1},meal_voucher:{amount:0,count:0}},openingFloat:50,expectedCash:60,countedCash:60,cashDifference:0,vat:vatBreakdown({items:[{total:10.55,vatRate:5.5},{total:11,vatRate:10},{total:12,vatRate:20}],total:33.55}),vatMissing:0};
 const csv=posMonthlyCsv([{z_number:1,opened_at:"2026-10-31T20:00:00Z",closed_at:"2026-10-31T23:30:00Z",z_report:r},{z_number:2,opened_at:"2026-10-01T20:00:00Z",closed_at:"2026-10-01T22:00:00Z",z_report:r}],"2026-11");expect(csv.split("\r\n")).toHaveLength(2);expect(csv).toContain('"HT 5.5%"');expect(csv).toContain('"TVA 10%"');expect(csv).toContain('"TTC 20%"');expect(csv).toContain('"33,55"');
 });
});