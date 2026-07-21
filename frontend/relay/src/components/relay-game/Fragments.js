// A curated pool of 2-letter fragments with decent word coverage
export const STARTING_FRAGMENTS = [
    "AS","BA","CA","DE","EX","FA","GA","HA","IN","JU",
    "LA","MA","NA","OP","PA","RA","SA","TA","UN","VA",
    "WA","AC","BE","CO","DI","EL","FI","GO","HO","IM",
    "LI","MO","NO","OB","PI","RE","SE","TI","AL","BI",
    "CU","RO","ST","TR","PR","GR","BL","CL","FL","SL"
  ];
  
  export const getRandomFragment = () => {
    return STARTING_FRAGMENTS[Math.floor(Math.random() * STARTING_FRAGMENTS.length)];
  };