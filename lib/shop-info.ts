// Canonical shop contact + social data, shared by the site footer, the
// social-links component and the newsletter email renderer so they can never
// drift apart. (There is no settings table for these — this module is the
// single source, matching the footer's long-standing values.)

export const SHOP = {
  name: "Antenne Recordshop",
  addressLine: "Noordstraat 82, 5038 EK Tilburg",
  addressNote: "Inside Sam-Sam vintage clothing store",
  phone: "+31 13 542 1708",
  phoneHref: "tel:+31135421708",
} as const;

export const SOCIAL_LINKS = [
  { label: "Facebook", href: "https://www.facebook.com/antennerecordshop/" },
  { label: "Instagram", href: "https://www.instagram.com/antenne.recordshop/" },
  { label: "SoundCloud", href: "https://soundcloud.com/antennerecordshoptilburg" },
] as const;
