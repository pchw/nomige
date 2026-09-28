import { createRequestHandler } from "react-router";

export { Room } from "../app/server/room";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request) {
    return requestHandler(request);
  },
} satisfies ExportedHandler<Env>;
