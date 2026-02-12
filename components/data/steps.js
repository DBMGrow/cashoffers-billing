export const steps = {
  blank: {
    title: "",
    description: "",
    component: "",
  },
  plan: {
    title: "Select a Plan.",
    description: "Choose a plan that's right for you.",
    component: "Plan",
  },
  email: {
    title: "What is your Email?",
    description: "You'll use this email to log in. You can change it later if you need to.",
    component: "Email",
  },
  emailLogin: {
    title: "What is your Email?",
    description: "Use the Email you signed up with.",
    component: "Email",
  },
  name: {
    title: "What is your Name?",
    description: "Enter your name how you would like it to show up to your clients.",
    component: "Name",
  },
  nameBroker: {
    title: "What is your Brokerage?",
    description: "Enter your Brokerage name.",
    component: "NameBroker",
  },
  nameTeam: {
    title: "What is your Team Name? (Optional)",
    description: "Enter your Team name.",
    component: "NameTeam",
  },
  slug: {
    title: "Please choose a Domain Prefix.",
    description:
      "This will be the consumer facing website URL that you can use instantly to generate leads.  After sign-up you can choose to add a custom domain to your account.",
    component: "Slug",
  },
  slugTaken: {
    title: "This Domain Prefix is already in use.",
    description: "Please try a different one.",
    component: "BackToSlug",
  },
  phone: {
    title: "What is your Phone Number?",
    description: "You can change this later.",
    component: "Phone",
  },
  card: {
    title: "What Card would you like to use?",
    description: "This card will be saved on file for your subscription.",
    component: "Card",
  },
  review: {
    title: "Review.",
    description: "How does everything look?",
    component: "Review",
  },
  welcome: {
    title: "Welcome to CashOffers.PRO",
    description: "Congrats! All you need to do now is set your password.",
    component: "Welcome",
  },
  UserExists: {
    title: "This Email is already in use.",
    description: "Please try a different email.",
    component: "UserExists",
  },
  error: {
    title: "Something went wrong.",
    description: "Please try again later.",
    component: false,
  },
  cardError: {
    title: "We were unable to process your Card.",
    description: "Please ensure your card information is correct.",
    component: "Card",
  },
  userDoesNotExist: {
    // used for manage user flow
    title: "There's no account linked to this email.",
    description: "Please try a different email.",
    component: "UserDoesNotExist",
  },
  noBilling: {
    title: "This account is not authorized to manage billing.",
    description: "Please try a different email, or contact support.",
    component: "UserDoesNotExist",
  },
  newBilling: {
    title: "Hey {name}, Let's get your billing set up.",
    description: "Please enter your card information.",
    component: "Card",
  },
  newCardKW: {
    title: "Hey {name}, Let's add a card to your account.",
    description: "Please enter your card information.",
    component: "Card",
  },
  login: {
    title: "Welcome back.",
    description: "Please enter your password.",
    component: "Login",
  },
  wrongPassword: {
    title: "Incorrect Password.",
    description: "Please try again.",
    component: "BackToLogin",
  },
  updateCard: {
    title: "Update your Card.",
    description: "Please enter your new card information.",
    component: "UpdateCard",
  },
  cardUpdated: {
    title: "Your Card has been updated.",
    description: "Thank you for choosing CashOffers.PRO.",
    component: "CardUpdated",
  },
  checkToken: {
    title: "",
    description: "",
    component: "CheckToken",
  },
  dashboard: {
    title: "Good to see you, {name}.",
    description: "What would you like to do today?",
    component: "Dashboard",
  },
  manageSubscription: {
    title: "Here's your current Subscription.",
    description: "Would you like to change your plan?",
    component: "ManageSubscription",
  },
  updatePlan: {
    title: "Choose a new Plan.",
    description: "Current Plan: {planName}",
    component: "UpdatePlan",
  },
  confirmPlanChanges: {
    title: "Confirm Plan Changes.",
    description: "Here’s how your subscription will change:",
    component: "PlanChanges",
  },
  reduceMaxUsers: {
    title: "Too Many Active Users.",
    description: "You have more active users than the plan you selected allows.",
    component: "ReduceMaxUsers",
  },
  reviewChangePlan: {
    title: "Review Plan Changes.",
    description: "How does everything look?",
    component: "ReviewChangePlan",
  },
  planChanged: {
    title: "Your Plan has been updated.",
    description: "Thank you for choosing CashOffers.PRO.",
    component: "PlanChanged",
  },
  setupCardComplete: {
    title: "Your Subscription has been updated.",
    description: "Thank you for choosing CashOffers.PRO.",
    component: "CardUpdated",
  },
  offerDowngrade: {
    title: "Reactivate Account.",
    description: "Do you want to reactivate your account as a freemium user?",
    component: "OfferDowngrade",
  },
  offerDowngradeConfirm: {
    title: "Email Sent.",
    description: "Please check your email for an invitation to reactivate your account.",
    component: false,
  },
  youreAllSetHomeUptick: {
    title: "You're all set!",
    description: "Your HomeUptick account is ready to go.",
    component: "YoureAllSet",
  },
}
