import { AgentGraphDefinition } from "@/types/graph";

export interface CanvasTemplate {
  id: string;
  name: string;
  badge: string;
  category: string;
  description: string;
  graph: AgentGraphDefinition;
}

const GRID_Y = 240;
const NODE_X = 260;

function _positions(count: number): { x: number; y: number }[] {
  const ys = Array.from({ length: count }, (_, i) => {
    const offset = count === 1 ? 0 : i - (count - 1) / 2;
    return GRID_Y + offset * 150;
  });
  return ys.map((y) => ({ x: NODE_X, y }));
}

export const CANVAS_TEMPLATES: CanvasTemplate[] = [
  {
    id: "supervisor_research_code_review",
    name: "Supervisor → Researcher → Coder → Critic",
    badge: "FULL MULTI-AGENT LOOP",
    category: "ORCHESTRATION",
    description:
      "A supervisor delegates to a research agent, hands findings to a coding agent, then a critic verifies the output. Critic failures route back to the coder for another pass.",
    graph: {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 40, y: GRID_Y }, data: { label: "START" } },
        {
          id: "supervisor",
          type: "supervisor",
          position: { x: NODE_X, y: GRID_Y - 150 },
          data: {
            label: "SUPERVISOR",
            prompt:
              "You are the supervisor of a software engineering crew. Analyze the incoming task and decide which specialist should act first: the researcher (to gather context) or the coder (to write code directly). Route by returning the matching edge label.",
          },
        },
        {
          id: "researcher",
          type: "agent",
          position: { x: NODE_X * 2, y: GRID_Y - 230 },
          data: {
            label: "RESEARCHER",
            prompt:
              "You are a research specialist. Investigate the task context, identify requirements, constraints, and risks. Produce a structured research brief with: 1) requirements 2) constraints 3) recommended approach. Be thorough and specific.",
          },
        },
        {
          id: "coder",
          type: "agent",
          position: { x: NODE_X * 3, y: GRID_Y - 150 },
          data: {
            label: "CODER",
            prompt:
              "You are a senior software engineer. Using the research brief and task context, write complete, production-quality code. Include explanations of key design decisions and note any assumptions. Output your code in a clearly delimited code block.",
          },
        },
        {
          id: "critic",
          type: "agent",
          position: { x: NODE_X * 4, y: GRID_Y - 230 },
          data: {
            label: "CRITIC / VERIFIER",
            prompt:
              "You are a rigorous code reviewer. Verify the implementation for correctness, edge cases, security issues, and completeness against the requirements. Respond with a verdict: either APPROVED (ready) or CHANGES_REQUIRED (list concrete fixes).",
          },
        },
        {
          id: "router_verdict",
          type: "router",
          position: { x: NODE_X * 5, y: GRID_Y - 150 },
          data: {
            label: "VERDICT",
            routerMode: "deterministic",
            condition: 'results.critic contains "APPROVED"',
          },
        },
        { id: "end", type: "end", position: { x: NODE_X * 6 + 40, y: GRID_Y }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "supervisor" },
        { id: "e2", source: "supervisor", target: "researcher", label: "research" },
        { id: "e3", source: "researcher", target: "coder" },
        { id: "e4", source: "coder", target: "critic" },
        { id: "e5", source: "critic", target: "router_verdict" },
        { id: "e6", source: "router_verdict", target: "coder", label: "false" },
        { id: "e7", source: "router_verdict", target: "end", label: "true" },
      ],
    },
  },
  {
    id: "map_reduce_invoice_screening",
    name: "Map-Reduce Invoice Screening",
    badge: "PARALLEL FAN-OUT · LOOP",
    category: "COMPLIANCE",
    description:
      "Fans every invoice line item out to a parallel extraction worker, then reduces the results through a deterministic compliance router with a retry loop for flagged lines.",
    graph: {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 40, y: GRID_Y }, data: { label: "START" } },
        {
          id: "parallel",
          type: "parallel",
          position: { x: NODE_X, y: GRID_Y },
          data: { label: "MAP · LINE ITEMS", parallelMode: "map", mapField: "input.lineItems" },
        },
        {
          id: "extractor",
          type: "tool",
          position: { x: NODE_X * 2, y: GRID_Y - 150 },
          data: {
            label: "AI EXTRACTOR",
            toolName: "ai_extraction",
            action: "extract",
            inputTemplate: { text: "{{ item }}" },
          },
        },
        {
          id: "classifier",
          type: "tool",
          position: { x: NODE_X * 3, y: GRID_Y - 150 },
          data: {
            label: "RISK CLASSIFIER",
            toolName: "ai_classification",
            action: "classify_risk",
            inputTemplate: { text: "{{ item }}" },
          },
        },
        {
          id: "router",
          type: "router",
          position: { x: NODE_X * 4, y: GRID_Y - 150 },
          data: {
            label: "RISK ROUTER",
            routerMode: "deterministic",
            condition: 'results.classifier.riskLevel == "URGENT"',
          },
        },
        {
          id: "loop",
          type: "loop",
          position: { x: NODE_X * 5, y: GRID_Y - 150 },
          data: { label: "RETRY LOOP", maxIterations: 3 },
        },
        {
          id: "recheck",
          type: "tool",
          position: { x: NODE_X * 5, y: GRID_Y - 300 },
          data: {
            label: "RECHECK",
            toolName: "deterministic_condition",
            action: "check_threshold",
            inputTemplate: { amount: "{{ item.amount }}", threshold: 1000 },
          },
        },
        { id: "end", type: "end", position: { x: NODE_X * 6 + 40, y: GRID_Y }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "parallel" },
        { id: "e2", source: "parallel", target: "extractor", label: "worker" },
        { id: "e3", source: "extractor", target: "classifier" },
        { id: "e4", source: "classifier", target: "router" },
        { id: "e5", source: "router", target: "loop", label: "true" },
        { id: "e6", source: "router", target: "end", label: "false" },
        { id: "e7", source: "loop", target: "recheck", label: "body" },
        { id: "e8", source: "loop", target: "end", label: "exit" },
      ],
    },
  },
  {
    id: "hitl_disbursement",
    name: "HITL-Gated Disbursement",
    badge: "APPROVAL GATE · CONDITIONAL",
    category: "FINANCE",
    description:
      "Extracts payment details, routes small amounts straight through and large amounts through a human approval gate before the disbursement action fires.",
    graph: {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 40, y: GRID_Y }, data: { label: "START" } },
        {
          id: "extractor",
          type: "tool",
          position: { x: NODE_X, y: GRID_Y },
          data: {
            label: "PAYMENT EXTRACTOR",
            toolName: "ai_extraction",
            action: "extract_payment",
            inputTemplate: { text: "{{ input.requestText }}" },
          },
        },
        {
          id: "router",
          type: "router",
          position: { x: NODE_X * 2, y: GRID_Y },
          data: {
            label: "AMOUNT ROUTER",
            routerMode: "deterministic",
            condition: "input.amount > 500",
          },
        },
        {
          id: "approval",
          type: "approval",
          position: { x: NODE_X * 3, y: GRID_Y - 150 },
          data: {
            label: "MANAGER APPROVAL",
            approvalReason: "Disbursement exceeds the $500 auto-approval threshold and requires manager sign-off.",
          },
        },
        {
          id: "dispatch",
          type: "tool",
          position: { x: NODE_X * 4, y: GRID_Y },
          data: {
            label: "DISBURSE",
            toolName: "mock_task_creator",
            action: "disburse_funds",
            inputTemplate: { amount: "{{ input.amount }}", recipient: "{{ input.recipient }}" },
          },
        },
        { id: "end", type: "end", position: { x: NODE_X * 5 + 40, y: GRID_Y }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "extractor" },
        { id: "e2", source: "extractor", target: "router" },
        { id: "e3", source: "router", target: "approval", label: "true" },
        { id: "e4", source: "router", target: "dispatch", label: "false" },
        { id: "e5", source: "approval", target: "dispatch" },
        { id: "e6", source: "dispatch", target: "end" },
      ],
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // GROUP 1: ZERO-KEY / OPEN PUBLIC API WORKFLOWS (NO KEY REQUIRED)
  // ══════════════════════════════════════════════════════════════════

  {
    id: "trending_tech_hackathon_radar",
    name: "Trending Tech & Hackathon Radar",
    badge: "ZERO-KEY · HACKER NEWS & GITHUB",
    category: "ZERO-KEY PUBLIC APIS",
    description:
      "Fetches live top stories from Hacker News and trending GitHub repositories, runs an AI Tech Scout to synthesize breakthroughs, and delivers an executive tech radar briefing via Webhook.",
    graph: {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 40, y: GRID_Y }, data: { label: "START" } },
        {
          id: "fetch_hn",
          type: "http",
          position: { x: NODE_X, y: GRID_Y - 120 },
          data: {
            label: "HACKER NEWS API",
            description: "Fetches top hacker news stories",
            httpMethod: "GET",
            httpUrl: "https://hacker-news.firebaseio.com/v0/topstories.json?print=pretty",
            httpResponseType: "json",
          },
        },
        {
          id: "fetch_github",
          type: "http",
          position: { x: NODE_X, y: GRID_Y + 120 },
          data: {
            label: "GITHUB SEARCH API",
            description: "Fetches trending repositories",
            httpMethod: "GET",
            httpUrl: "https://api.github.com/search/repositories?q=stars:>1000+pushed:>2026-01-01&sort=updated&order=desc&per_page=8",
            httpResponseType: "json",
          },
        },
        {
          id: "aggregate_feeds",
          type: "aggregate",
          position: { x: NODE_X * 2, y: GRID_Y },
          data: {
            label: "COMBINE FEEDS",
            aggregateMode: "merge",
          },
        },
        {
          id: "tech_scout_agent",
          type: "agent",
          position: { x: NODE_X * 3, y: GRID_Y },
          data: {
            label: "AI TECH SCOUT",
            prompt:
              "You are a Principal Technology Scout. Analyze the live Hacker News discussions and trending GitHub repositories in the context. Synthesize an Executive Tech Radar Briefing with: 1) Breakthrough Emerging Tech Themes, 2) Notable Open Source Repositories with architecture highlights, 3) Hackathon/Project Inspiration with suggested tech stacks.",
          },
        },
        {
          id: "dispatch_alert",
          type: "notification_dispatcher",
          position: { x: NODE_X * 4, y: GRID_Y },
          data: {
            label: "DISCORD/SLACK DISPATCH",
            dispatchDestination: "discord",
            dispatchMessage: "🚀 **Daily Tech Radar & Hackathon Radar Briefing:**\n\n{{ results.tech_scout_agent }}",
          },
        },
        { id: "end", type: "end", position: { x: NODE_X * 5 + 40, y: GRID_Y }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "fetch_hn" },
        { id: "e2", source: "start", target: "fetch_github" },
        { id: "e3", source: "fetch_hn", target: "aggregate_feeds" },
        { id: "e4", source: "fetch_github", target: "aggregate_feeds" },
        { id: "e5", source: "aggregate_feeds", target: "tech_scout_agent" },
        { id: "e6", source: "tech_scout_agent", target: "dispatch_alert" },
        { id: "e7", source: "dispatch_alert", target: "end" },
      ],
    },
  },

  {
    id: "web_page_intel_summarizer",
    name: "Web Page Intel & Summarizer",
    badge: "ZERO-KEY · JINA READER",
    category: "ZERO-KEY PUBLIC APIS",
    description:
      "Converts any live website URL into clean LLM-ready markdown using Jina Reader (r.jina.ai) without browser scrapers, extracts core intelligence, and structures an executive dossier.",
    graph: {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 40, y: GRID_Y }, data: { label: "START" } },
        {
          id: "jina_reader",
          type: "web_reader",
          position: { x: NODE_X, y: GRID_Y },
          data: {
            label: "JINA WEB READER",
            readerUrl: "{{ input.targetUrl }}",
            readerFormat: "markdown",
          },
        },
        {
          id: "data_mapper",
          type: "data_mapper",
          position: { x: NODE_X * 2, y: GRID_Y },
          data: {
            label: "MAP ARTICLE DATA",
            mapperSchema: {
              targetUrl: "results.jina_reader.url",
              markdownLength: "results.jina_reader.length",
              contentPreview: "results.jina_reader.markdown",
            },
          },
        },
        {
          id: "intel_agent",
          type: "agent",
          position: { x: NODE_X * 3, y: GRID_Y },
          data: {
            label: "INTEL ANALYST AGENT",
            prompt:
              "You are an Elite Intelligence Analyst. Analyze the markdown webpage content provided. Output a high-impact Structured Intel Memo: 1) Executive Summary (3 sentences), 2) Key Metrics & Data Points, 3) Strategic Implications / SWOT, 4) Notable Quotes & Citations.",
          },
        },
        {
          id: "output_dossier",
          type: "output",
          position: { x: NODE_X * 4, y: GRID_Y },
          data: {
            label: "STRUCTURED DOSSIER",
            outputTemplate: "### Intelligence Dossier for {{ results.jina_reader.url }}\n\n{{ results.intel_agent }}",
          },
        },
        { id: "end", type: "end", position: { x: NODE_X * 5 + 40, y: GRID_Y }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "jina_reader" },
        { id: "e2", source: "jina_reader", target: "data_mapper" },
        { id: "e3", source: "data_mapper", target: "intel_agent" },
        { id: "e4", source: "intel_agent", target: "output_dossier" },
        { id: "e5", source: "output_dossier", target: "end" },
      ],
    },
  },

  {
    id: "arxiv_ai_research_paper_scout",
    name: "ArXiv AI Research Paper Scout",
    badge: "ZERO-KEY · ARXIV PUBLIC API",
    category: "ZERO-KEY PUBLIC APIS",
    description:
      "Queries recent research papers in cs.AI / cs.CL from ArXiv's public API, runs a Researcher Agent to evaluate model architecture innovations, and produces a structured research memo.",
    graph: {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 40, y: GRID_Y }, data: { label: "START" } },
        {
          id: "arxiv_api",
          type: "rss_feed",
          position: { x: NODE_X, y: GRID_Y },
          data: {
            label: "ARXIV PUBLIC FEED",
            rssUrl: "https://export.arxiv.org/rss/cs.AI",
            rssMaxItems: 10,
          },
        },
        {
          id: "researcher_agent",
          type: "agent",
          position: { x: NODE_X * 2, y: GRID_Y },
          data: {
            label: "AI RESEARCH SCIENTIST",
            prompt:
              "You are an AI Research Scientist. Review the newly published ArXiv papers in cs.AI. Filter for breakthroughs in: 1) LLM reasoning and agent architectures, 2) Test-time compute / RLHF, 3) Multimodal efficiency. For each standout paper, provide: Title, Core Innovation, Methodology, and Practical Engineering Takeaway.",
          },
        },
        {
          id: "output_memo",
          type: "output",
          position: { x: NODE_X * 3, y: GRID_Y },
          data: {
            label: "RESEARCH MEMO",
            outputTemplate: "## ArXiv Breakthrough Radar\n\n{{ results.researcher_agent }}",
          },
        },
        { id: "end", type: "end", position: { x: NODE_X * 4 + 40, y: GRID_Y }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "arxiv_api" },
        { id: "e2", source: "arxiv_api", target: "researcher_agent" },
        { id: "e3", source: "researcher_agent", target: "output_memo" },
        { id: "e4", source: "output_memo", target: "end" },
      ],
    },
  },

  {
    id: "extreme_weather_disaster_alert",
    name: "Extreme Weather & Disaster Alert",
    badge: "ZERO-KEY · OPEN-METEO & USGS",
    category: "ZERO-KEY PUBLIC APIS",
    description:
      "Monitors live seismic data from USGS and weather forecasts from Open-Meteo without authentication; triggers emergency response advisory when thresholds are exceeded.",
    graph: {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 40, y: GRID_Y }, data: { label: "START" } },
        {
          id: "weather_api",
          type: "http",
          position: { x: NODE_X, y: GRID_Y - 120 },
          data: {
            label: "OPEN-METEO API",
            httpMethod: "GET",
            httpUrl: "https://api.open-meteo.com/v1/forecast?latitude=37.77&longitude=-122.42&current_weather=true&hourly=temperature_2m,wind_speed_10m",
            httpResponseType: "json",
          },
        },
        {
          id: "usgs_api",
          type: "http",
          position: { x: NODE_X, y: GRID_Y + 120 },
          data: {
            label: "USGS SEISMIC API",
            httpMethod: "GET",
            httpUrl: "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=4.5&limit=5",
            httpResponseType: "json",
          },
        },
        {
          id: "router_alert",
          type: "router",
          position: { x: NODE_X * 2, y: GRID_Y },
          data: {
            label: "RISK ROUTER",
            routerMode: "deterministic",
            condition: 'results.weather_api.current_weather.windspeed > 20 || (results.usgs_api.features && results.usgs_api.features.length > 0)',
          },
        },
        {
          id: "disaster_agent",
          type: "agent",
          position: { x: NODE_X * 3, y: GRID_Y - 100 },
          data: {
            label: "EMERGENCY ADVISORY AGENT",
            prompt:
              "You are an Emergency Response Coordinator. Given the live weather conditions and seismic data, formulate a clear, actionable Civil Safety Bulletin with hazard levels, precautionary measures, and emergency hotline contact protocol.",
          },
        },
        {
          id: "emergency_dispatch",
          type: "notification_dispatcher",
          position: { x: NODE_X * 4, y: GRID_Y - 100 },
          data: {
            label: "EMERGENCY BROADCAST",
            dispatchDestination: "discord",
            dispatchMessage: "🚨 **CIVIL SAFETY ADVISORY ALERT:**\n\n{{ results.disaster_agent }}",
          },
        },
        { id: "end", type: "end", position: { x: NODE_X * 5 + 40, y: GRID_Y }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "weather_api" },
        { id: "e2", source: "start", target: "usgs_api" },
        { id: "e3", source: "weather_api", target: "router_alert" },
        { id: "e4", source: "usgs_api", target: "router_alert" },
        { id: "e5", source: "router_alert", target: "disaster_agent", label: "true" },
        { id: "e6", source: "router_alert", target: "end", label: "false" },
        { id: "e7", source: "disaster_agent", target: "emergency_dispatch" },
        { id: "e8", source: "emergency_dispatch", target: "end" },
      ],
    },
  },

  {
    id: "subreddit_sentiment_bug_sentinel",
    name: "Subreddit Sentiment & Bug Sentinel",
    badge: "ZERO-KEY · REDDIT PUBLIC JSON",
    category: "ZERO-KEY PUBLIC APIS",
    description:
      "Ingests open community posts from Reddit's public JSON feeds, runs sentiment and bug-detection agents, and flags critical issues to engineering queues.",
    graph: {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 40, y: GRID_Y }, data: { label: "START" } },
        {
          id: "reddit_feed",
          type: "http",
          position: { x: NODE_X, y: GRID_Y },
          data: {
            label: "REDDIT PUBLIC JSON",
            httpMethod: "GET",
            httpUrl: "https://www.reddit.com/r/reactjs/hot.json?limit=15",
            httpResponseType: "json",
          },
        },
        {
          id: "data_mapper",
          type: "data_mapper",
          position: { x: NODE_X * 2, y: GRID_Y },
          data: {
            label: "EXTRACT POSTS",
            mapperSchema: {
              posts: "results.reddit_feed.data.children",
            },
          },
        },
        {
          id: "sentinel_agent",
          type: "agent",
          position: { x: NODE_X * 3, y: GRID_Y },
          data: {
            label: "BUG & SENTIMENT AGENT",
            prompt:
              "You are a Product Quality Sentinel. Analyze the community posts from the subreddit feed. 1) Identify recurring user pain points and reported bugs, 2) Compute an overall Community Sentiment Score (-100 to +100), 3) Extract Top 3 Feature Requests.",
          },
        },
        {
          id: "output_sentinel",
          type: "output",
          position: { x: NODE_X * 4, y: GRID_Y },
          data: {
            label: "COMMUNITY REPORT",
            outputTemplate: "## Community Sentinel Report\n\n{{ results.sentinel_agent }}",
          },
        },
        { id: "end", type: "end", position: { x: NODE_X * 5 + 40, y: GRID_Y }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "reddit_feed" },
        { id: "e2", source: "reddit_feed", target: "data_mapper" },
        { id: "e3", source: "data_mapper", target: "sentinel_agent" },
        { id: "e4", source: "sentinel_agent", target: "output_sentinel" },
        { id: "e5", source: "output_sentinel", target: "end" },
      ],
    },
  },

  {
    id: "wikipedia_fact_checker_enricher",
    name: "Wikipedia Fact-Checker & Enricher",
    badge: "ZERO-KEY · WIKIMEDIA REST API",
    category: "ZERO-KEY PUBLIC APIS",
    description:
      "Performs autonomous grounding against Wikimedia REST endpoints to verify user statements, flag hallucinations, and generate citation-backed explanations.",
    graph: {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 40, y: GRID_Y }, data: { label: "START" } },
        {
          id: "wiki_api",
          type: "http",
          position: { x: NODE_X, y: GRID_Y },
          data: {
            label: "WIKIMEDIA REST API",
            httpMethod: "GET",
            httpUrl: "https://en.wikipedia.org/api/rest_v1/page/summary/Artificial_intelligence",
            httpResponseType: "json",
          },
        },
        {
          id: "fact_checker_agent",
          type: "agent",
          position: { x: NODE_X * 2, y: GRID_Y },
          data: {
            label: "GROUNDING & FACT CHECKER",
            prompt:
              "You are a Rigorous Fact-Checking Agent. Ground the context claims using the authoritative Wikimedia summary text. Verify dates, definitions, key people, and historical milestones. Output: 1) Fact-Check Verdict (VERIFIED / DISPUTED / UNCONFIRMED), 2) Corrected Claims with citations, 3) In-Depth Context Expansion.",
          },
        },
        {
          id: "output_fact_report",
          type: "output",
          position: { x: NODE_X * 3, y: GRID_Y },
          data: {
            label: "VERIFICATION REPORT",
            outputTemplate: "## Wikipedia Fact-Check & Knowledge Enrichment\n\n{{ results.fact_checker_agent }}",
          },
        },
        { id: "end", type: "end", position: { x: NODE_X * 4 + 40, y: GRID_Y }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "wiki_api" },
        { id: "e2", source: "wiki_api", target: "fact_checker_agent" },
        { id: "e3", source: "fact_checker_agent", target: "output_fact_report" },
        { id: "e4", source: "output_fact_report", target: "end" },
      ],
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // GROUP 2: DEVELOPER & SECURITY AUTOMATION WORKFLOWS
  // ══════════════════════════════════════════════════════════════════

  {
    id: "zero_day_cve_watcher",
    name: "Zero-Day & CVE Vulnerability Watcher",
    badge: "DEVSEC · CIRCL CVE & HITL GATE",
    category: "SECURITY & DEVOPS",
    description:
      "Monitors newly published CVE vulnerabilities via CIRCL/OSV.dev, filters high severity (CVSS > 7.0), triggers a SecOps Impact Agent, and requires human approval before dispatching incident alerts.",
    graph: {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 40, y: GRID_Y }, data: { label: "START" } },
        {
          id: "fetch_cve",
          type: "http",
          position: { x: NODE_X, y: GRID_Y },
          data: {
            label: "CIRCL CVE API",
            httpMethod: "GET",
            httpUrl: "https://cve.circl.lu/api/last/10",
            httpResponseType: "json",
          },
        },
        {
          id: "severity_router",
          type: "router",
          position: { x: NODE_X * 2, y: GRID_Y },
          data: {
            label: "CVSS SEVERITY FILTER",
            routerMode: "deterministic",
            condition: 'results.fetch_cve.length > 0',
          },
        },
        {
          id: "secops_agent",
          type: "agent",
          position: { x: NODE_X * 3, y: GRID_Y - 120 },
          data: {
            label: "SECOPS IMPACT AGENT",
            prompt:
              "You are a Lead Security Operations (SecOps) Engineer. Analyze the incoming CVE vulnerability feed. Assess the impact on web applications, Node.js/Python microservices, and container infrastructure. Produce an Urgent Incident Mitigation Plan.",
          },
        },
        {
          id: "approval_gate",
          type: "approval",
          position: { x: NODE_X * 4, y: GRID_Y - 120 },
          data: {
            label: "SECURITY LEAD SIGN-OFF",
            approvalReason: "High-severity CVE vulnerability detected. Security lead approval required before dispatching team alert.",
          },
        },
        {
          id: "dispatch_slack",
          type: "notification_dispatcher",
          position: { x: NODE_X * 5, y: GRID_Y - 120 },
          data: {
            label: "SLACK INCIDENT ALERT",
            dispatchDestination: "slack",
            dispatchMessage: "🛡️ **CRITICAL SECURITY CVE ALERT:**\n\n{{ results.secops_agent }}",
          },
        },
        { id: "end", type: "end", position: { x: NODE_X * 6 + 40, y: GRID_Y }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "fetch_cve" },
        { id: "e2", source: "fetch_cve", target: "severity_router" },
        { id: "e3", source: "severity_router", target: "secops_agent", label: "true" },
        { id: "e4", source: "severity_router", target: "end", label: "false" },
        { id: "e5", source: "secops_agent", target: "approval_gate" },
        { id: "e6", source: "approval_gate", target: "dispatch_slack" },
        { id: "e7", source: "dispatch_slack", target: "end" },
      ],
    },
  },

  {
    id: "seo_core_web_vitals_auditor",
    name: "SEO & Core Web Vitals Auditor",
    badge: "DEVTOOLS · GOOGLE PAGESPEED",
    category: "SECURITY & DEVOPS",
    description:
      "Runs Google PageSpeed Insights & Wayback Machine snapshots, extracts LCP, FID, CLS scores, and has an AI Performance Architect generate a step-by-step remediation guide.",
    graph: {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 40, y: GRID_Y }, data: { label: "START" } },
        {
          id: "pagespeed_http",
          type: "http",
          position: { x: NODE_X, y: GRID_Y - 100 },
          data: {
            label: "PAGESPEED INSIGHTS",
            httpMethod: "GET",
            httpUrl: "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://web.dev&strategy=mobile",
            httpResponseType: "json",
          },
        },
        {
          id: "wayback_http",
          type: "http",
          position: { x: NODE_X, y: GRID_Y + 100 },
          data: {
            label: "WAYBACK MACHINE API",
            httpMethod: "GET",
            httpUrl: "https://archive.org/wayback/available?url=https://web.dev",
            httpResponseType: "json",
          },
        },
        {
          id: "data_mapper",
          type: "data_mapper",
          position: { x: NODE_X * 2, y: GRID_Y },
          data: {
            label: "EXTRACT VITALS",
            mapperSchema: {
              lighthouse: "results.pagespeed_http.lighthouseResult",
              history: "results.wayback_http.archived_snapshots",
            },
          },
        },
        {
          id: "seo_architect_agent",
          type: "agent",
          position: { x: NODE_X * 3, y: GRID_Y },
          data: {
            label: "PERFORMANCE ARCHITECT",
            prompt:
              "You are a Senior Web Performance Architect. Analyze the Google PageSpeed Core Web Vitals (LCP, FID, CLS, TTFB, Speed Index). Produce a structured Technical SEO & Performance Remediation Blueprint: 1) Executive Performance Score, 2) Critical Bottlenecks, 3) Code-Level Fixes (CSS/JS splitting, image optimization, caching).",
          },
        },
        { id: "end", type: "end", position: { x: NODE_X * 4 + 40, y: GRID_Y }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "pagespeed_http" },
        { id: "e2", source: "start", target: "wayback_http" },
        { id: "e3", source: "pagespeed_http", target: "data_mapper" },
        { id: "e4", source: "wayback_http", target: "data_mapper" },
        { id: "e5", source: "data_mapper", target: "seo_architect_agent" },
        { id: "e6", source: "seo_architect_agent", target: "end" },
      ],
    },
  },

  {
    id: "package_release_changelog_notifier",
    name: "Package Release & Changelog Notifier",
    badge: "DEVOPS · NPM & PYPI REGISTRIES",
    category: "SECURITY & DEVOPS",
    description:
      "Monitors package releases on NPM and PyPI, compares version bumps, and generates breaking change migration steps for engineering teams.",
    graph: {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 40, y: GRID_Y }, data: { label: "START" } },
        {
          id: "npm_api",
          type: "http",
          position: { x: NODE_X, y: GRID_Y - 100 },
          data: {
            label: "NPM REGISTRY API",
            httpMethod: "GET",
            httpUrl: "https://registry.npmjs.org/next/latest",
            httpResponseType: "json",
          },
        },
        {
          id: "pypi_api",
          type: "http",
          position: { x: NODE_X, y: GRID_Y + 100 },
          data: {
            label: "PYPI REGISTRY API",
            httpMethod: "GET",
            httpUrl: "https://pypi.org/pypi/fastapi/json",
            httpResponseType: "json",
          },
        },
        {
          id: "migration_agent",
          type: "agent",
          position: { x: NODE_X * 2, y: GRID_Y },
          data: {
            label: "MIGRATION ENGINEER AGENT",
            prompt:
              "You are a Staff Software Engineer. Analyze the latest package releases from NPM (Next.js) and PyPI (FastAPI). Extract version identifiers, detect breaking architectural changes, and draft migration instructions for team codebases.",
          },
        },
        {
          id: "dispatch_changelog",
          type: "notification_dispatcher",
          position: { x: NODE_X * 3, y: GRID_Y },
          data: {
            label: "DISCORD CHANGELOG DISPATCH",
            dispatchDestination: "discord",
            dispatchMessage: "📦 **New Package Releases & Migration Guide:**\n\n{{ results.migration_agent }}",
          },
        },
        { id: "end", type: "end", position: { x: NODE_X * 4 + 40, y: GRID_Y }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "npm_api" },
        { id: "e2", source: "start", target: "pypi_api" },
        { id: "e3", source: "npm_api", target: "migration_agent" },
        { id: "e4", source: "pypi_api", target: "migration_agent" },
        { id: "e5", source: "migration_agent", target: "dispatch_changelog" },
        { id: "e6", source: "dispatch_changelog", target: "end" },
      ],
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // GROUP 3: FINANCIAL & BUSINESS INTELLIGENCE WORKFLOWS
  // ══════════════════════════════════════════════════════════════════

  {
    id: "crypto_momentum_arbitrage_pulse",
    name: "Crypto Momentum & Arbitrage Pulse",
    badge: "FINTECH · COINGECKO & BINANCE",
    category: "FINANCE & INTEL",
    description:
      "Fetches real-time price changes from CoinGecko and Binance public ticker endpoints, routes on high volatility (> 5% 24h delta), and triggers an AI Quant Analyst.",
    graph: {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 40, y: GRID_Y }, data: { label: "START" } },
        {
          id: "coingecko_api",
          type: "http",
          position: { x: NODE_X, y: GRID_Y - 100 },
          data: {
            label: "COINGECKO PUBLIC API",
            httpMethod: "GET",
            httpUrl: "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true",
            httpResponseType: "json",
          },
        },
        {
          id: "binance_api",
          type: "http",
          position: { x: NODE_X, y: GRID_Y + 100 },
          data: {
            label: "BINANCE TICKER API",
            httpMethod: "GET",
            httpUrl: "https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT",
            httpResponseType: "json",
          },
        },
        {
          id: "volatility_router",
          type: "router",
          position: { x: NODE_X * 2, y: GRID_Y },
          data: {
            label: "VOLATILITY ROUTER (>5%)",
            routerMode: "deterministic",
            condition: 'results.coingecko_api.bitcoin || results.binance_api.priceChangePercent',
          },
        },
        {
          id: "quant_agent",
          type: "agent",
          position: { x: NODE_X * 3, y: GRID_Y },
          data: {
            label: "QUANTITATIVE ANALYST AGENT",
            prompt:
              "You are a Senior Quantitative Crypto Analyst. Analyze the real-time prices, 24h momentum deltas, and cross-venue spreads between CoinGecko and Binance. Identify momentum breakouts, support/resistance levels, and cross-exchange arbitrage opportunities.",
          },
        },
        {
          id: "telegram_dispatch",
          type: "notification_dispatcher",
          position: { x: NODE_X * 4, y: GRID_Y },
          data: {
            label: "TELEGRAM/DISCORD DISPATCH",
            dispatchDestination: "telegram",
            dispatchMessage: "🪙 **Crypto Momentum & Arbitrage Alert:**\n\n{{ results.quant_agent }}",
          },
        },
        { id: "end", type: "end", position: { x: NODE_X * 5 + 40, y: GRID_Y }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "coingecko_api" },
        { id: "e2", source: "start", target: "binance_api" },
        { id: "e3", source: "coingecko_api", target: "volatility_router" },
        { id: "e4", source: "binance_api", target: "volatility_router" },
        { id: "e5", source: "volatility_router", target: "quant_agent", label: "true" },
        { id: "e6", source: "volatility_router", target: "end", label: "false" },
        { id: "e7", source: "quant_agent", target: "telegram_dispatch" },
        { id: "e8", source: "telegram_dispatch", target: "end" },
      ],
    },
  },

  {
    id: "global_fx_inflation_monitor",
    name: "Global FX & Inflation Monitor",
    badge: "FINTECH · FRANKFURTER & WORLD BANK",
    category: "FINANCE & INTEL",
    description:
      "Pulls live cross-currency foreign exchange rates from Frankfurter and macroeconomic inflation indicators from the World Bank to generate currency risk and hedging reports.",
    graph: {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 40, y: GRID_Y }, data: { label: "START" } },
        {
          id: "fx_api",
          type: "http",
          position: { x: NODE_X, y: GRID_Y - 100 },
          data: {
            label: "FRANKFURTER FX API",
            httpMethod: "GET",
            httpUrl: "https://api.frankfurter.app/latest?from=USD",
            httpResponseType: "json",
          },
        },
        {
          id: "world_bank_api",
          type: "http",
          position: { x: NODE_X, y: GRID_Y + 100 },
          data: {
            label: "WORLD BANK DATA API",
            httpMethod: "GET",
            httpUrl: "https://api.worldbank.org/v2/country/US/indicator/FP.CPI.TOTL.ZG?format=json",
            httpResponseType: "json",
          },
        },
        {
          id: "macro_agent",
          type: "agent",
          position: { x: NODE_X * 2, y: GRID_Y },
          data: {
            label: "MACRO ECONOMIST AGENT",
            prompt:
              "You are a Chief Global Macroeconomist. Analyze the latest USD foreign exchange conversion rates (EUR, GBP, JPY, CAD) and World Bank Consumer Price Index (CPI) inflation figures. Formulate an actionable Executive FX & Purchasing Power Strategy Report for cross-border commerce.",
          },
        },
        {
          id: "output_report",
          type: "output",
          position: { x: NODE_X * 3, y: GRID_Y },
          data: {
            label: "MACROECONOMIC REPORT",
            outputTemplate: "## Global Macroeconomic & FX Strategy Report\n\n{{ results.macro_agent }}",
          },
        },
        { id: "end", type: "end", position: { x: NODE_X * 4 + 40, y: GRID_Y }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "fx_api" },
        { id: "e2", source: "start", target: "world_bank_api" },
        { id: "e3", source: "fx_api", target: "macro_agent" },
        { id: "e4", source: "world_bank_api", target: "macro_agent" },
        { id: "e5", source: "macro_agent", target: "output_report" },
        { id: "e6", source: "output_report", target: "end" },
      ],
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // GROUP 4: OPEN-SOURCE & SELF-HOSTED STACK WORKFLOWS
  // ══════════════════════════════════════════════════════════════════

  {
    id: "open_source_deep_research_studio",
    name: "Open-Source Deep Research & Report Studio",
    badge: "OPEN SOURCE · SEARXNG + CRAWL4AI + GOTENBERG",
    category: "OPEN SOURCE & SELF-HOSTED",
    description:
      "Performs privacy-first web research via SearXNG, extracts clean markdown via Crawl4AI, synthesizes an executive brief, and compiles a publication-ready PDF via Gotenberg.",
    graph: {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 40, y: GRID_Y }, data: { label: "START" } },
        {
          id: "searxng_node",
          type: "searxng_search",
          position: { x: NODE_X, y: GRID_Y },
          data: {
            label: "SEARXNG SEARCH",
            searxngHost: "https://searx.be",
            searxngQuery: "{{ input.query }}",
            searxngLimit: 5,
          },
        },
        {
          id: "crawl_node",
          type: "crawl4ai_scrape",
          position: { x: NODE_X * 2, y: GRID_Y },
          data: {
            label: "CRAWL4AI SCRAPER",
            crawl4aiUrl: "{{ results.searxng_node.results[0].url }}",
            crawl4aiWordCountThreshold: 20,
          },
        },
        {
          id: "researcher_agent",
          type: "agent",
          position: { x: NODE_X * 3, y: GRID_Y },
          data: {
            label: "RESEARCH SCIENTIST",
            prompt:
              "You are a Principal AI Research Scientist. Analyze the web search results and deep markdown extracted by Crawl4AI. Produce an exhaustive Executive Research Briefing with: 1) Executive Summary, 2) Technical Innovations & Architecture, 3) Benchmark Comparisons, 4) Recommended Deployment Strategy.",
          },
        },
        {
          id: "gotenberg_node",
          type: "gotenberg_pdf_exporter",
          position: { x: NODE_X * 4, y: GRID_Y },
          data: {
            label: "GOTENBERG PDF EXPORTER",
            gotenbergHost: "http://localhost:3000",
            gotenbergPaperSize: "A4",
            gotenbergHtmlContent: "<h1>Executive Deep Research Report</h1><p>{{ results.researcher_agent }}</p>",
          },
        },
        { id: "end", type: "end", position: { x: NODE_X * 5 + 40, y: GRID_Y }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "searxng_node" },
        { id: "e2", source: "searxng_node", target: "crawl_node" },
        { id: "e3", source: "crawl_node", target: "researcher_agent" },
        { id: "e4", source: "researcher_agent", target: "gotenberg_node" },
        { id: "e5", source: "gotenberg_node", target: "end" },
      ],
    },
  },

  {
    id: "docling_paper_knowledge_pipeline",
    name: "Docling Paper & Document Knowledge Pipeline",
    badge: "OPEN SOURCE · DOCLING + NOCODB",
    category: "OPEN SOURCE & SELF-HOSTED",
    description:
      "Ingests complex research PDFs or corporate documents with Docling (IBM), extracts structured tables and insights with an AI Analyst, and persists the structured record into NocoDB.",
    graph: {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 40, y: GRID_Y }, data: { label: "START" } },
        {
          id: "docling_node",
          type: "docling_pdf_parser",
          position: { x: NODE_X, y: GRID_Y },
          data: {
            label: "DOCLING PDF PARSER",
            doclingDocumentUrl: "{{ input.documentUrl }}",
            doclingOutputFormat: "markdown",
          },
        },
        {
          id: "analyst_agent",
          type: "agent",
          position: { x: NODE_X * 2, y: GRID_Y },
          data: {
            label: "DOCUMENT INTEL AGENT",
            prompt:
              "You are a Technical Document Analyst. Parse the structured markdown and tables generated by Docling. Extract key claims, authors, baseline comparisons, and novel contributions in a structured JSON object.",
          },
        },
        {
          id: "nocodb_node",
          type: "nocodb_record",
          position: { x: NODE_X * 3, y: GRID_Y },
          data: {
            label: "NOCODB KNOWLEDGE LOG",
            nocodbHost: "http://localhost:8080",
            nocodbTableId: "tbl_research_papers",
            nocodbOperation: "create",
            nocodbData: {
              documentUrl: "{{ input.documentUrl }}",
              summary: "{{ results.analyst_agent }}",
              status: "INDEXED",
            },
          },
        },
        { id: "end", type: "end", position: { x: NODE_X * 4 + 40, y: GRID_Y }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "docling_node" },
        { id: "e2", source: "docling_node", target: "analyst_agent" },
        { id: "e3", source: "analyst_agent", target: "nocodb_node" },
        { id: "e4", source: "nocodb_node", target: "end" },
      ],
    },
  },

  {
    id: "voice_dispatcher_whisper_piper",
    name: "Multi-Agent Voice Dispatch & Transcription",
    badge: "LOCAL AI · FASTER-WHISPER + PIPER TTS",
    category: "OPEN SOURCE & SELF-HOSTED",
    description:
      "Transcribes customer voice recordings with Faster-Whisper, runs an AI Triage Agent to classify intent, synthesizes a voice response with Piper TTS, and dispatches alerts.",
    graph: {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 40, y: GRID_Y }, data: { label: "START" } },
        {
          id: "whisper_node",
          type: "audio_transcriber",
          position: { x: NODE_X, y: GRID_Y },
          data: {
            label: "FASTER-WHISPER STT",
            audioSourceUrl: "{{ input.audioUrl }}",
            audioLanguage: "auto",
          },
        },
        {
          id: "triage_agent",
          type: "agent",
          position: { x: NODE_X * 2, y: GRID_Y },
          data: {
            label: "VOICE TRIAGE AGENT",
            prompt:
              "You are an Elite Customer Support Voice Dispatcher. Analyze the transcribed audio message. Formulate a polite, helpful spoken response answering the user's inquiry directly.",
          },
        },
        {
          id: "piper_node",
          type: "piper_tts",
          position: { x: NODE_X * 3, y: GRID_Y - 100 },
          data: {
            label: "PIPER VOICE SYNTHESIS",
            piperVoice: "en_US-lessac-medium",
            piperText: "{{ results.triage_agent }}",
          },
        },
        {
          id: "dispatch_node",
          type: "notification_dispatcher",
          position: { x: NODE_X * 4, y: GRID_Y },
          data: {
            label: "DISCORD/SLACK DISPATCH",
            dispatchDestination: "discord",
            dispatchMessage: "🎙️ **Voice Dispatch Processed:**\n\n**Transcript:** {{ results.whisper_node.text }}\n\n**Agent Answer:** {{ results.triage_agent }}",
          },
        },
        { id: "end", type: "end", position: { x: NODE_X * 5 + 40, y: GRID_Y }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "whisper_node" },
        { id: "e2", source: "whisper_node", target: "triage_agent" },
        { id: "e3", source: "triage_agent", target: "piper_node" },
        { id: "e4", source: "piper_node", target: "dispatch_node" },
        { id: "e5", source: "dispatch_node", target: "end" },
      ],
    },
  },

  {
    id: "qdrant_vector_memory_rag",
    name: "Vector Memory & Persistent Long-Term RAG",
    badge: "SELF-HOSTED · QDRANT + POCKETBASE",
    category: "OPEN SOURCE & SELF-HOSTED",
    description:
      "Performs semantic recall over self-hosted Qdrant vector collections, grounds the AI reasoner with past conversation history, and stores state in PocketBase.",
    graph: {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 40, y: GRID_Y }, data: { label: "START" } },
        {
          id: "qdrant_node",
          type: "qdrant_vector_memory",
          position: { x: NODE_X, y: GRID_Y },
          data: {
            label: "QDRANT VECTOR RECALL",
            qdrantCollection: "knowledge_base",
            qdrantQuery: "{{ input.query }}",
            qdrantTopK: 3,
          },
        },
        {
          id: "reasoning_agent",
          type: "agent",
          position: { x: NODE_X * 2, y: GRID_Y },
          data: {
            label: "CONTEXT REASONER AGENT",
            prompt:
              "You are a Context-Aware Knowledge Agent. Use the retrieved context vectors from Qdrant to formulate a comprehensive, factually grounded response for the user inquiry.",
          },
        },
        {
          id: "pocketbase_node",
          type: "pocketbase_store",
          position: { x: NODE_X * 3, y: GRID_Y },
          data: {
            label: "POCKETBASE LOG STORE",
            pocketbaseCollection: "agent_sessions",
            pocketbaseAction: "create",
            pocketbaseData: {
              query: "{{ input.query }}",
              response: "{{ results.reasoning_agent }}",
            },
          },
        },
        { id: "end", type: "end", position: { x: NODE_X * 4 + 40, y: GRID_Y }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "qdrant_node" },
        { id: "e2", source: "qdrant_node", target: "reasoning_agent" },
        { id: "e3", source: "reasoning_agent", target: "pocketbase_node" },
        { id: "e4", source: "pocketbase_node", target: "end" },
      ],
    },
  },

  {
    id: "windmill_activepieces_orchestrator",
    name: "Windmill & Activepieces Distributed Orchestration",
    badge: "OPEN WORKFLOWS · CRON + HTTP + AGENT",
    category: "OPEN SOURCE & SELF-HOSTED",
    description:
      "Triggers self-hosted Windmill Python scripts or Activepieces webhooks on a schedule, evaluates data anomalies with a Router, and delegates remediation to an AI Operator.",
    graph: {
      version: 1,
      nodes: [
        { id: "start", type: "start", position: { x: 40, y: GRID_Y }, data: { label: "START" } },
        {
          id: "cron_trigger",
          type: "schedule_trigger",
          position: { x: NODE_X, y: GRID_Y },
          data: {
            label: "DAILY CRON TRIGGER",
            cronExpression: "0 8 * * *",
            scheduleInterval: "Every day at 8:00 AM UTC",
          },
        },
        {
          id: "windmill_http",
          type: "http",
          position: { x: NODE_X * 2, y: GRID_Y },
          data: {
            label: "WINDMILL / ACTIVEPIECES API",
            httpMethod: "POST",
            httpUrl: "http://localhost:8000/api/w/main/jobs/run/f/sync_database",
            httpResponseType: "json",
          },
        },
        {
          id: "anomaly_router",
          type: "router",
          position: { x: NODE_X * 3, y: GRID_Y },
          data: {
            label: "HEALTH ROUTER",
            routerMode: "deterministic",
            condition: "results.windmill_http.status == 'SUCCESS'",
          },
        },
        {
          id: "operator_agent",
          type: "agent",
          position: { x: NODE_X * 4, y: GRID_Y - 120 },
          data: {
            label: "OPS REMEDIATION AGENT",
            prompt:
              "You are an Autonomous Site Reliability Operator. The upstream automation script reported an anomaly. Diagnose the error log and generate a concrete mitigation action.",
          },
        },
        {
          id: "dispatch_alert",
          type: "notification_dispatcher",
          position: { x: NODE_X * 5, y: GRID_Y },
          data: {
            label: "SLACK OPS BROADCAST",
            dispatchDestination: "slack",
            dispatchMessage: "⚙️ **Distributed Orchestrator Run Complete:**\n\n{{ results }}",
          },
        },
        { id: "end", type: "end", position: { x: NODE_X * 6 + 40, y: GRID_Y }, data: { label: "END" } },
      ],
      edges: [
        { id: "e1", source: "start", target: "cron_trigger" },
        { id: "e2", source: "cron_trigger", target: "windmill_http" },
        { id: "e3", source: "windmill_http", target: "anomaly_router" },
        { id: "e4", source: "anomaly_router", target: "operator_agent", label: "false" },
        { id: "e5", source: "anomaly_router", target: "dispatch_alert", label: "true" },
        { id: "e6", source: "operator_agent", target: "dispatch_alert" },
        { id: "e7", source: "dispatch_alert", target: "end" },
      ],
    },
  },
];
