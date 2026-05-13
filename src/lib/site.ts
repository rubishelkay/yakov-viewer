export const siteConfig = {
  name: "Yakov Shmol",
  title: "Yakov Shmol - Photographic Archive",
  description:
    "A quiet photographic archive of film rolls, digital notes, selected work, and individual frames.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://yakov.shmol.cc",
  nav: [
    { href: "/", label: "Index" },
    { href: "/films", label: "Films" },
    { href: "/archive", label: "Archive" },
    { href: "/about", label: "About" }
  ]
};
