import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";

export default function TalkToYourData() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          <h1 className="text-2xl font-semibold text-foreground">Talk to Your Data</h1>
          <p className="mt-2 text-muted-foreground">Chat feature coming soon!</p>
        </main>
      </div>
    </div>
  );
}
