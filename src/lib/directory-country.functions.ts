import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { countryFromHostname } from "./country";

export const getDirectoryCountry = createServerFn({ method: "GET" }).handler(() => {
  const request = getRequest();
  return countryFromHostname(new URL(request.url).hostname);
});