[![smithery badge](https://smithery.ai/badge/@hamid-vakilzadeh/mcpsemanticscholar)](https://smithery.ai/server/@hamid-vakilzadeh/mcpsemanticscholar)

# AI - Research Assistant

<div style="background-color:rgb(114, 114, 114); color: white; padding: 12px; border-left: 4px solid #007acc;">
  The MCP project extends the work we started in our academic paper on using AI as a research assistant. In that paper, we focused on retrieval-augmented generation (RAG) as a practical approach to support research tasks. By the time the paper was published, we had already moved forward with MCP, which takes the core ideas further and delivers a more capable system. While MCP isn’t covered in the paper, it continues the same effort and reflects what we learned along the way. 
  <br>
  <br>
  If you’re referencing this project, please also cite the following paper to acknowledge the original research:
  <br>
  <strong style="color: Black;">Vakilzadeh, H., and Wood, D. A. (2025). The Development of a RAG-Based Artificial Intelligence Research Assistant (AIRA). <em>Journal of Information Systems forthcoming</em>.</strong>

</div>

<div style="background-color:rgb(56, 166, 120); color: white; padding: 12px; border-left: 4px solid #007acc;">
  <p>To use this MCP:</p>
  <ol>
  <li>Install <a style="color: blue;" href="https://nodejs.org">Node.JS</a></li>
  <li>Install the MCP server for <a style="color: blue;" href="https://smithery.ai/server/@hamid-vakilzadeh/mcpsemanticscholar">AI Research Assistant - Semantic Scholar</a></li>
  <li>Restart your AI platform (aka Claude Desktop)</li>
  </ol>

</div>

## Semantic Scholar MCP Server

A Model Context Protocol (MCP) server that provides AI models with comprehensive access to the Semantic Scholar Academic Graph API. This server enables intelligent literature search, paper analysis, and citation network exploration through a robust set of tools, resources, and prompts.

## Features

### 🔍 **Comprehensive Paper Search**

- **Basic Search**: Simple keyword-based paper discovery
- **Advanced Search**: Multi-filter search with year ranges, citation thresholds, field of study filters, and publication type restrictions
- **Title Matching**: Find papers by closest title match with confidence scoring
- **Batch Operations**: Retrieve multiple papers efficiently (up to 500 papers per request)

### 👥 **Author Discovery & Analysis**

- Search authors by name or affiliation
- Retrieve detailed author profiles with metrics (h-index, citation counts, paper counts)
- Access complete publication lists for any author

### 📊 **Citation Network Analysis**

- Explore papers that cite a specific work
- Analyze reference lists and citation patterns
- Multi-depth citation network traversal for comprehensive impact analysis

### 📚 **Field-Specific Research**

- Browse top papers by academic field
- Filter research by publication venues
- Access open access publications specifically

## MCP Resources

The server exposes three main resource types accessible via URI templates:

- **`paper://{paperId}`** - Detailed paper information including abstract, authors, venue, and metrics
- **`author://{authorId}`** - Complete author profiles with affiliations and research metrics
- **`field://{fieldOfStudy}`** - Top papers in specific academic disciplines

## MCP Tools

### Paper Research Tools

- `papers-search-basic` - Simple keyword search
- `papers-search-advanced` - Multi-criteria filtering with publication types, date ranges, and citation thresholds
- `papers-match` - Find papers by title similarity
- `papers-get` - Retrieve detailed paper information
- `papers-batch` - Bulk paper retrieval
- `papers-citations` - Analyze citing papers
- `papers-references` - Explore referenced works

### Author Research Tools

- `authors-search` - Find researchers by name or affiliation
- `authors-papers` - Complete publication lists

### Analysis Tools

- `analysis-citation-network` - Comprehensive citation network analysis with configurable depth

## MCP Prompts

Pre-configured prompts for common academic research workflows:

- **`literature-review`** - Systematic literature review with trend analysis and gap identification
- **`citation-analysis`** - Impact assessment and influence tracking
- **`research-gap-finder`** - Identify unexplored research opportunities

## Key Capabilities

- **Rate-Limited API Access**: Intelligent request throttling (10 req/sec standard, 1 req/sec for batch operations)
- **Comprehensive Error Handling**: Robust error management with detailed feedback
- **Flexible Filtering**: Advanced query building with support for all Semantic Scholar filter parameters
- **Type-Safe Implementation**: Full TypeScript support with comprehensive type definitions
- **Pagination Support**: Handle large result sets efficiently

## Use Cases

- **Literature Reviews**: Discover and analyze research trends across academic fields
- **Citation Analysis**: Track research impact and identify influential papers
- **Research Discovery**: Find relevant papers, authors, and venues for ongoing research
- **Academic Network Analysis**: Explore collaboration patterns and citation relationships
- **Gap Analysis**: Identify underexplored research areas and opportunities

## Getting Started

1. Obtain a Semantic Scholar API key (optional but recommended for higher rate limits)
2. Configure the server with your API key via environment variable `SEMANTIC_SCHOLAR_API_KEY`
3. Deploy using your preferred MCP client or integration platform

The server provides immediate access to millions of academic papers and author profiles, making it an essential tool for AI-powered research assistance and academic exploration.
