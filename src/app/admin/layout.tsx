import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import BaseSidebar from "@/components/BaseSidebar";

const adminLinks = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/questions", label: "Frågebank" },
  { href: "/admin/surveys", label: "Enkäter" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/admin/login");
  }
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50 text-gray-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded"
      >
        Hoppa till innehåll
      </a>
      <BaseSidebar
        links={adminLinks}
        headerContent={<h1 className="text-lg font-bold mb-6 px-3">Enkätplattform</h1>}
        mobileTopbar={<span className="font-bold text-sm">Enkätplattform</span>}
      />
      <main id="main-content" className="flex-1 p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
