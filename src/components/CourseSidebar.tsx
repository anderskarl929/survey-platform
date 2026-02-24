"use client";

import Link from "next/link";
import BaseSidebar from "@/components/BaseSidebar";

interface CourseSidebarProps {
  courseId: number;
  courseName: string;
}

export default function CourseSidebar({ courseId, courseName }: CourseSidebarProps) {
  const base = `/admin/courses/${courseId}`;

  const links = [
    { href: base, label: "Dashboard", exact: true },
    { href: `${base}/questions`, label: "Frågebank" },
    { href: `${base}/surveys`, label: "Enkäter" },
    { href: `${base}/students`, label: "Elever" },
  ];

  return (
    <BaseSidebar
      links={links}
      headerContent={
        <>
          <Link href="/admin" className="text-xs text-gray-300 hover:text-white mb-2">
            &larr; Alla kurser
          </Link>
          <h1 className="text-lg font-bold mb-4 px-3">{courseName}</h1>
        </>
      }
      mobileTopbar={
        <div className="flex items-center gap-2">
          <Link href="/admin" className="text-gray-300 hover:text-white text-xs">&larr;</Link>
          <span className="font-bold text-sm truncate">{courseName}</span>
        </div>
      }
    />
  );
}
