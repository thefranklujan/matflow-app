import { MATFLOW } from "@/lib/constants";

export default function Footer() {
  return (
    <footer className="bg-brand-dark border-t border-brand-gray mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <p className="text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} {MATFLOW.name}. All rights reserved.
          </p>
          <p className="text-gray-600 text-xs mt-1">{MATFLOW.tagline}</p>
        </div>
      </div>
    </footer>
  );
}
