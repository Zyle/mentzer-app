export const QUOTES = {
  preWorkout: [
    "The object is to stimulate growth, not annihilate the muscle. One set, taken to failure, is all that is required.",
    "If you train hard and briefly, and rest long enough, you will grow. It is that simple.",
    "You must train with a weight heavy enough to force your body to adapt. Anything less is a waste of time.",
    "High intensity effort is the single most important factor in stimulating muscular growth. Everything else is secondary.",
    "The last rep — the one you almost cannot complete — is the only one that matters.",
  ],
  postWorkout: [
    "You have done your job. Now get out of the gym and let your body grow.",
    "Growth does not happen in the gym. It happens during rest. Your only task now is to recover.",
    "You have stimulated the growth mechanism. Do not interfere with it by training again too soon.",
    "The workout is over. The most productive thing you can do now is nothing.",
    "Brief, intense, infrequent. You have been brief and intense. Now be infrequent.",
  ],
  restDay: [
    "Every day you rest is a day you grow. Do not confuse inactivity with laziness.",
    "The gym is where growth is stimulated. Everywhere else is where growth is produced.",
    "More training is not better training. Your body is building muscle right now. Let it finish.",
    "Patience is not passive. It is the active decision to allow your body to complete its work.",
    "The most common mistake in bodybuilding is not doing too little — it is doing too much.",
  ],
  progression: [
    "If you are getting stronger, you are on the right track. Even one extra rep is significant.",
    "Progressive overload is the only objective evidence that growth has occurred.",
    "Add weight when you can. Add reps when you cannot. Always move forward.",
    "Strength precedes size. Get stronger and the muscle will follow.",
    "You should be getting stronger on a very regular basis. If you are not, something is wrong.",
  ],
  plateau: [
    "When progress stops, the answer is never more training. It is always less, and more rest.",
    "A plateau is not a failure of effort. It is a signal that your recovery needs more time.",
    "Reduce the volume. Extend the rest. Your body will respond.",
    "The instinct to do more when progress stalls is exactly wrong. Resist it.",
    "Take a full week off. Come back stronger. This is not weakness — it is science.",
  ],
  weightIncrease: [
    "You have earned this weight increase. Now prove you deserve it.",
    "Progressive resistance is the cornerstone of all muscular development. You are doing it right.",
    "Increase the weight. Force the body to adapt to a new level of demand.",
    "The muscles have adapted to this weight. Give them something new to conquer.",
  ],
  recovery: [
    "Day one. Your muscles are repairing. The growth process has been triggered.",
    "Day two. Supercompensation is beginning. Muscle tissue is actively rebuilding.",
    "Day three. Your body is building additional muscle beyond its previous capacity.",
    "You are recovered and ready. The work you did is complete. Now do it again.",
  ],
};

export const getRandomQuote = (category) => {
  const categoryQuotes = QUOTES[category] || QUOTES.restDay;
  return categoryQuotes[Math.floor(Math.random() * categoryQuotes.length)];
};
