import Link from "next/link";
import { PageState } from "@/components/ui";

export const metadata = {
  title: "Not found · Facet",
};

/**
 * Every unknown address, and every `/p/…` link to a page that is not live —
 * the API answers 404 for a draft on purpose. A visitor lands here as often
 * as the owner does, so it says what may have happened without assuming
 * which of them is reading.
 */
export default function NotFound() {
  return (
    <PageState
      mark="404"
      title="This page isn’t here"
      note="The address may be mistyped, or the page may have been unpublished or moved by its owner."
    >
      <Link href="/" className="btn btn-primary" style={{ marginTop: 0 }}>
        Go to Facet
      </Link>
    </PageState>
  );
}
