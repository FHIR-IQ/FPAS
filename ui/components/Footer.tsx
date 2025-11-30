import Link from "next/link";
import { Github, Twitter } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white mt-auto">
      <div className="mx-auto max-w-7xl px-6 py-8 md:flex md:items-center md:justify-between lg:px-8">
        <div className="flex justify-center space-x-6 md:order-2">
          <Link
            href="https://github.com/fhir-iq"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-gray-500"
          >
            <span className="sr-only">GitHub</span>
            <Github className="h-6 w-6" aria-hidden="true" />
          </Link>
          <Link
            href="https://twitter.com/fhiriq"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-gray-500"
          >
            <span className="sr-only">Twitter</span>
            <Twitter className="h-6 w-6" aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-8 md:order-1 md:mt-0">
          <p className="text-center text-xs leading-5 text-gray-500">
            &copy; {new Date().getFullYear()} FHIR IQ. All rights reserved.
          </p>
          <div className="mt-2 flex justify-center space-x-4 text-xs text-gray-400">
            <span>v1.0.0</span>
            <span>•</span>
            <Link href="/privacy" className="hover:text-gray-500">
              Privacy
            </Link>
            <span>•</span>
            <Link href="/terms" className="hover:text-gray-500">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
