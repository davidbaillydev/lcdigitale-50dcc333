// Point d'entrée historique des paiements : réexporte à l'identique les modules par prestataire
// (src/lib/payments/*). Les clés restent côté serveur et ne sont jamais renvoyées en clair.
export { PROVIDERS, type Provider } from "./payments/shared";
export { listPaymentProviders, savePaymentProvider } from "./payments/settings";
export { testSumup, pairSumupReader } from "./payments/sumup";
export {
  TERMINALS, type TerminalKind, getKioskTerminal, setKioskTerminal, testKioskTerminal, kioskTerminalAvailable,
  kioskTerminalReady, startKioskCardPayment, kioskPaymentStatus, cancelKioskPayment, abandonKioskOrder,
} from "./payments/terminal";
export { kioskQrReady, kioskQrAvailable, startKioskQrPayment, kioskQrStatus, abandonKioskQr } from "./payments/kiosk-qr";
export { stripeCall, stripeForRestaurant, testStripe } from "./payments/stripe";
export { testPaypal } from "./payments/paypal";
export {
  MOLLIE_PLATFORM_FEE_RATE, mollieApplicationFee, exchangeMollieCode, mollieForRestaurant, mollieCall, verifyMollieState,
  mollieRedirectUri, startMollieConnect, saveMollieOauth, disconnectMollie, testMollie, handleMolliePayment, listMolliePayments,
} from "./payments/mollie";
export { testLyra, handleLyraResult } from "./payments/lyra";
export { startOnlinePayment, onlinePaymentInfo, confirmOnlinePayment } from "./payments/online";
