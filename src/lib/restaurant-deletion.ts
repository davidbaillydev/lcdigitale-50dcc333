export function exactRestaurantConfirmation(name: string, confirmation: string) {
  return name.length > 0 && confirmation === name;
}