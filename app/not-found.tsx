import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap py-24 text-center">
      <h1 className="page-title">Not in the ledger</h1>
      <p className="intro mx-auto">This page or girl doesn&rsquo;t exist. If you just summoned her, give the network a few seconds and refresh.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn">Back to the shrine</Link>
        <Link href="/my-girls" className="btn btn-ghost">My girls</Link>
      </div>
    </div>
  );
}
