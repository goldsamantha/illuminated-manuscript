import type { Metadata } from "next";
import BorderBuilder from "@/components/BorderBuilder";

export const metadata: Metadata = { title: "Border builder — Illuminated Manuscript" };

export default function BuilderPage() {
  return <BorderBuilder />;
}
