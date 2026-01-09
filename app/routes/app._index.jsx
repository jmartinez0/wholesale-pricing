import { redirect } from "react-router";

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  const search = url.search;

  return redirect(`/app/pricing${search}`);
};

export default function AppIndex() {
  return null;
}