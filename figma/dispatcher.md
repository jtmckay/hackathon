A conversational AI agent that IS the dispatcher/operations manager for Shamrock Plumbing.
Not a dashboard. Not a monitoring tool. The agent itself is the product. You talk to it like you'd talk to the person running the front office, and it makes decisions and takes actions.
Here's why this is the right call:
The judges are going to interact with it live and throw curveballs. That means the interface needs to be conversational. They'll say things like "hey, I've got water pouring through my ceiling" or "my tech just called in sick" or "a customer is furious about a job we did yesterday" and the agent needs to handle it. Not ask for clarification twelve times. Not give a summary of options. Handle it. Make the call. Execute.

What it looks like:
A chat interface. That's it. But behind the chat is Blake's entire business: the schedule, the tech roster, the customer database, the pricing logic, and the intent layer. When someone talks to it, the agent pulls from all of that context to make autonomous decisions.
The two workflows to go deep on:

1. Customer intake to dispatch — Someone calls (messages) with a plumbing problem. The agent qualifies the issue, checks the schedule, evaluates which tech to send based on skill and proximity, books the job, and sends confirmations. All without human intervention. If it's an emergency, it triggers the triage flow, bumps non-urgent jobs, notifies affected customers, and dispatches.

2. Disruption recovery — Something goes wrong mid-day. Tech calls in sick. Job runs long. Customer cancels. Emergency comes in. The agent autonomously rebuilds the schedule, makes tradeoff decisions based on Blake's intent statements, communicates with all affected parties, and briefs Blake on what it did.
These two workflows chain together naturally, they're decision-dense, and they're exactly where the judges will throw curveballs.

What the judges see during the demo:
You open the chat. You say "it's Monday morning, what does today look like?" The agent shows the day's schedule with reasoning. Then you hit it with scenarios: "Mrs. Patterson just called, her water heater is leaking everywhere." The agent triages it, pulls a tech, reschedules displaced jobs, sends notifications, all visible in the conversation with its reasoning shown. Then you throw a curveball: "actually Jake just texted, he's sick today." The agent rebuilds the entire day on the fly.

The intent layer shows up when the agent explains WHY it made each decision. "I pulled Marcus from the Johnson job instead of Tyler from the Garcia job because Mrs. Garcia is a 6-year customer and Blake's rules say repeat customers don't get bumped for new ones."

Tech stack for the build:
React frontend (simple chat UI with a side panel showing the current schedule state), FastAPI or Node backend, Claude API for the reasoning engine, and a SQLite or in-memory JSON store for the business data (techs, customers, schedule, jobs). The intent statements get injected into the system prompt for every decision. No vector database needed. No RAG. Keep it simple and make the decision-making deep.

The whole thing should be buildable in 6 hours if you scope it right. The first two hours go to data setup and the core agent loop. The next three hours go to making the two workflows bulletproof and handling edge cases. The last hour goes to polishing the demo flow and stress-testing with curveballs.
