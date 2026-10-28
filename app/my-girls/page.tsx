import type { Metadata } from "next";
import { MyGirls } from "./MyGirls";

export const metadata: Metadata = { title: "My girls", description: "The girls in your connected wallet and what they've earned." };

export default function MyGirlsPage() {
  return (
    <div className="wrap py-12 sm:py-16">
      <h1 className="page-title">My girls</h1>
      <p className="intro">Every girl in the connected wallet, her milk, her share of the network and what she has earned so far.</p>
      <MyGirls />
    </div>
  );
}
