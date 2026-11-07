import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { posEnabled } from "./pos-register";
import { posLinesSchema, posDiscountSchema } from "./pos-register.functions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function guard(db: any, userId: string, restaurantId: string) {
  const { data: ok } = await db.rpc("is_restaurant_manager", { _user_id: userId, _restaurant_id: restaurantId });
  if (!ok) throw new Error("Réservé au responsable.");
  const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
  const { data: r } = await admin.from("restaurants").select("config,enabled_features").eq("id",restaurantId).single();
  if (!posEnabled(r)) throw new Error("Caisse non activée.");
  return admin;
}
const rid = z.object({ restaurantId: z.string().uuid() });
export const getParkedCarts = createServerFn({ method:"POST" }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => rid.parse(d)).handler(async ({data,context}) => {
  const admin = await guard(context.supabase,context.userId,data.restaurantId);
  const {data: rows,error} = await admin.from("pos_parked_carts").select("*").eq("restaurant_id",data.restaurantId).is("recalled_at",null).order("created_at");
  if(error) throw new Error("Paniers indisponibles."); return rows ?? [];
});
export const parkPosCart = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>rid.extend({requestId:z.string().uuid(),label:z.string().trim().min(1).max(60),draft:z.object({mode:z.enum(["pickup","dine_in"]),lines:posLinesSchema,discount:posDiscountSchema.nullable()})}).parse(d)).handler(async({data,context})=>{
 const admin=await guard(context.supabase,context.userId,data.restaurantId);
 const {data:s}=await admin.from("pos_sessions").select("id").eq("restaurant_id",data.restaurantId).is("closed_at",null).single();
 if(!s) throw new Error("Caisse fermée.");
 const {error}=await admin.from("pos_parked_carts").insert({restaurant_id:data.restaurantId,session_id:s.id,label:data.label,draft:data.draft as never,created_by:context.userId,request_id:data.requestId});
 if(error && error.code!=="23505") throw new Error("Mise en attente impossible."); return {ok:true};
});
export const recallPosCart = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>rid.extend({id:z.string().uuid()}).parse(d)).handler(async({data,context})=>{
 const admin=await guard(context.supabase,context.userId,data.restaurantId);
 const {data:row,error}=await admin.from("pos_parked_carts").update({recalled_at:new Date().toISOString()}).eq("restaurant_id",data.restaurantId).eq("id",data.id).is("recalled_at",null).select("draft").single();
 if(error || !row) throw new Error("Panier déjà repris."); return row.draft;
});
export const addPosCashMovement = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>rid.extend({requestId:z.string().uuid(),kind:z.enum(["in","out"]),amount:z.number().positive().max(100000),reason:z.string().trim().min(3).max(200)}).parse(d)).handler(async({data,context})=>{
 const admin=await guard(context.supabase,context.userId,data.restaurantId);
 const {data:s}=await admin.from("pos_sessions").select("id").eq("restaurant_id",data.restaurantId).is("closed_at",null).single();
 if(!s) throw new Error("Caisse fermée.");
 const {error}=await admin.from("pos_cash_events").insert({restaurant_id:data.restaurantId,session_id:s.id,kind:data.kind,amount:Math.round(data.amount*100)/100,reason:data.reason,created_by:context.userId,request_id:data.requestId});
 if(error && error.code!=="23505") throw new Error("Mouvement impossible."); return {ok:true};
});
export const voidPosSale = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:unknown)=>rid.extend({orderId:z.string().uuid(),requestId:z.string().uuid(),reason:z.string().trim().min(3).max(200)}).parse(d)).handler(async({data,context})=>{
 const admin=await guard(context.supabase,context.userId,data.restaurantId);
 const {error}=await admin.rpc("void_pos_sale",{_restaurant_id:data.restaurantId,_order_id:data.orderId,_user_id:context.userId,_reason:data.reason,_request_id:data.requestId});
 if(error) throw new Error("Annulation impossible : vente introuvable ou caisse déjà clôturée."); return {ok:true};
});