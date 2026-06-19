export const talentProfile = {
  name: "Shelby Carter",
  role: "Model / Brand Ambassador",
  status: "Available this week",
  rating: "Preferred",
  nextGig: "Red Hot Winter Campaign",
  payPending: "$225",
  city: "Vandalia, IL",
  phone: "(555) 014-2291",
  email: "shelby@example.com",
  bio: "Available for promo events, product shoots, brand activations, and social content.",
  roles: ["Model", "Brand Ambassador", "Influencer"],
  notAvailableFor: ["Merch production", "Heavy setup", "Loading/unloading"],
  sizes: {
    shirt: "S",
    shoe: "8",
    height: "5'7\""
  },
  socials: {
    instagram: "@shelbycreates",
    tiktok: "@shelbycreates"
  },
  agreements: [
    { name: "Talent Agreement", status: "Signed" },
    { name: "Photo Release", status: "Signed" },
    { name: "W-9", status: "Needs update" }
  ]
};

export const gigOpportunities = [
  {
    id: "gig-1001",
    eventId: "evt-2044",
    date: "2026-06-21",
    title: "PAM Product Shoot",
    role: "Model",
    location: "Studio A",
    pay: "$125 flat",
    status: "Open",
    contractStatus: "Contract sent after admin confirmation",
    requirements: "Product modeling only. No production, packing, setup, or manual labor.",
    deliverables: "12 photo looks, 2 short video clips",
    time: "2:00 PM - 5:00 PM",
    dressCode: "Black fitted outfit, clean sneakers, light glam.",
    manualLabor: "No",
    contentRequired: "Yes",
    appearanceRequired: "Yes",
    notes: "Arrive camera-ready. Final call sheet appears after admin confirms your booking."
  },
  {
    id: "gig-1002",
    eventId: "evt-2049",
    date: "2026-06-27",
    title: "Client Launch Party",
    role: "Brand Ambassador",
    location: "Effingham, IL",
    pay: "$30/hr",
    status: "Open",
    contractStatus: "Not sent",
    requirements: "Customer-facing promo, guest greeting, and social tags.",
    deliverables: "Event appearance, 3 story posts",
    time: "7:00 PM - 11:00 PM",
    dressCode: "Black Label approved event look.",
    manualLabor: "No",
    contentRequired: "Yes",
    appearanceRequired: "Yes",
    notes: "Must be comfortable talking to guests and representing the brand."
  },
  {
    id: "gig-1003",
    eventId: "evt-2051",
    date: "2026-07-02",
    title: "Influencer Content Drop",
    role: "Influencer",
    location: "Remote",
    pay: "$50 + product",
    status: "Open",
    contractStatus: "Not sent",
    requirements: "Remote content only.",
    deliverables: "1 reel, 3 story frames",
    time: "Post window: July 2 - July 4",
    dressCode: "Product-forward styling.",
    manualLabor: "No",
    contentRequired: "Yes",
    appearanceRequired: "No",
    notes: "Content guidelines and tags are released after assignment approval."
  }
];

export const myAssignments = [
  {
    id: "assign-501",
    eventId: "evt-2039",
    date: "2026-06-18",
    title: "Red Hot Winter Campaign",
    role: "Model",
    location: "Vandalia, IL",
    pay: "$100 flat",
    status: "Confirmed",
    contractStatus: "Needs signature",
    paymentStatus: "Pending completion"
  },
  {
    id: "assign-502",
    eventId: "evt-2041",
    date: "2026-06-20",
    title: "Merch Booth Activation",
    role: "Brand Ambassador",
    location: "County Fairgrounds",
    pay: "$75 flat",
    status: "Confirmed",
    contractStatus: "Signed",
    paymentStatus: "Pending"
  }
];

export const calendarDays = [
  { day: 18, label: "Confirmed", tone: "confirmed", title: "Red Hot Winter" },
  { day: 20, label: "Booked", tone: "confirmed", title: "Booth Activation" },
  { day: 21, label: "Open", tone: "open", title: "Product Shoot" },
  { day: 24, label: "Unavailable", tone: "blocked", title: "Blocked out" },
  { day: 27, label: "Open", tone: "open", title: "Launch Party" }
];
