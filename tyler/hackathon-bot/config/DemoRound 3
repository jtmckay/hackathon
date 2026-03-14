 What's New                                                                                                                
                                                                                                                            
  ScheduleService (src/database/schedule.service.ts)                                                                        
                                                                                                                            
  Three DB mutation methods triggered on dispatch:                                                                          
  - assignEmergency() — creates the emergency job, pauses the tech's active job                                             
  - markJobsDisplaced() — marks their remaining scheduled jobs as needs_rescheduling                                        
  - getDisplacedJobs() — fetches displaced jobs for the ops report                  
                                                                                                                            
  Two new Claude tools                                                                                                      
                                                                                                                            
  dispatch_tech — Claude calls this when address is confirmed + severity is set. It passes: selected tech + full reasoning  
  for every tech considered + IDs of jobs to pause/displace. Fires once per incident (dispatchFired set).                   
                                                                                                                            
  escalate_to_blake — Called when Claude determines no tech can be safely dispatched. Posts ⚠️  ALL TECHS UNAVAILABLE to ops.
  
  Multi-tool handling in AgentService                                                                                       
                                                            
  A single turn can now fire multiple tools (e.g., post_emergency_alert + dispatch_tech simultaneously if Claude has enough 
  info). All tool results are bundled into one user message before the final customer-facing response is generated.
                                                                                                                            
  System prompt additions                                                                                                   
  
  - Tech roster now shows derived Seniority: SENIOR/MID/JUNIOR based on certifications (master_plumber = SENIOR, journeyman 
  + extra cert = MID, journeyman only = JUNIOR)             
  - Zone Drive Times table (north/south/east/west matrix, 5–25 min)                                                         
  - Dispatch Protocol section — full evaluation rubric: skill match, seniority rule, bumpability, proximity, tier-impact,   
  and intent hierarchy in order                                                                                             
                                                                                                                            
  Ops channel posts on dispatch                                                                                             
                                                            
  1. DISPATCH DECISION — selected tech with reason + every rejected tech with why + displaced jobs list                     
  2. DISPATCH ORDER — tech-specific brief: customer, address, issue, safety, ETA, "head there now"
                                                                                                                            
  ---                                                       
  Full Flow Now                                                                                                             
                                                                                                                            
  Customer: "WATER EVERYWHERE BASEMENT FLOODING"
    → Bot: calm response + water main shutoff instructions [post_emergency_alert fires → 🚨 alert in group]                 
                                                                                                                            
  Customer: "Im at 1247 Oak Street, main is off"                                                                            
    → Bot recognizes Elena Martinez (platinum, north zone)                                                                  
    → Evaluates: Mike (north, SENIOR, 5min away, bumpable job) ✓
                 Sarah (south, 25min) — farther                                                                             
                 James (east, JUNIOR) — cannot send alone
                 Carlos (west, 20min) — viable but farther                                                                  
    → [dispatch_tech fires]                                 
    → DB: emergency job created, Mike's jobs paused/displaced                                                               
    → Ops: 📋 DISPATCH DECISION + DISPATCH ORDER — MIKE RODRIGUEZ
    → Customer: "Mike is on his way, about 5 minutes away..."