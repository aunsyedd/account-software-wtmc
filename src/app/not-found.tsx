import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export default function NotFound() {
  return (
    <div className="notfound">
      <div className="notfound-logo">
        <BrandMark animated />
      </div>
      <p className="notfound-code">404</p>
      <h1>Page not found</h1>
      <p className="muted">The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
      <Link className="btn btn-green" href="/dashboard">
        Back to dashboard
      </Link>
    </div>
  );
}
