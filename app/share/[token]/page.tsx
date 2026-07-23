import SharedProject from "./shared-project";

export const dynamic = "force-dynamic";

export default async function SharedProjectPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SharedProject token={token} />;
}
