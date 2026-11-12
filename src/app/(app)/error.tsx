"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Icon } from "@/components/Icon";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="state-card">
      <div className="state-icon state-icon--danger">
        <Icon name="alert" size={26} />
      </div>
      <h2>Something went wrong</h2>
      <p>
        We couldn&apos;t load this page. Check your internet connection and try again. If the problem continues,
        the record may have been deleted.
      </p>
      {error.digest ? <p className="hint">Reference: {error.digest}</p> : null}
      <div className="btn-row" style={{ justifyContent: "center" }}>
        <button className="btn btn-green" type="button" onClick={() => reset()}>
          Try again
        </button>
        <Link className="btn btn-gray" href="/dashboard">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
