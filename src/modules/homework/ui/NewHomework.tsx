"use client";
import { useState } from "react";
import HomeworkForm from "./HomeworkForm";

export default function NewHomework(props: { classrooms: { id: string; name: string }[]; subjects: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card mb-4 px-4 py-2.5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Yeni ödev</h2>
        <button className="btn-secondary" onClick={() => setOpen(!open)}>{open ? "Kapat" : "+ Ödev ver"}</button>
      </div>
      {open && (
        <div className="mt-4">
          <HomeworkForm {...props} />
          <p className="mt-2 text-xs text-lead">Ödev, seçilen sınıftaki tüm öğrencilere “Bekliyor” durumuyla atanır.</p>
        </div>
      )}
    </div>
  );
}
