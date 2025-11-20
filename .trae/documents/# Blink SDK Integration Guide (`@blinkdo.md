# Blink SDK Integration Guide (`@blinkdotnew/sdk`)

This guide documents the usage of the Blink SDK for the y0 app. It covers all major operations excluding user authentication. Access is managed via Project IDs.

## Available Project IDs
Use one of the following Project IDs to initialize the client, depending on the context:
1. `yetr-content-creation-models-obbf3aln` 
2. `yeti-search-engine-perplexity-clone-tccg0y3b` 
3. `yebo-social-platform-dnm7dimx` 
4. `yetiarc-genspark-clone-frnb0kyj` 

## Initialization

Initialize the client with your chosen Project ID. We explicitly disable authentication requirements to allow open access for these agents.

```typescript
import { createClient } from '@blinkdotnew/sdk'

// Replace 'your-project-id' with one of the IDs listed above
const blink = createClient({
  projectId: 'your-project-id', 
  authRequired: false // Disable forced auth
})
```

## Database Operations
The SDK provides zero-config CRUD operations. It automatically converts between camelCase (JS) and snake_case (DB).

### Create
```typescript
const todo = await blink.db.todos.create({
  title: 'New Task',
  description: 'Task details',
  isCompleted: false
})
```

### Read (List)
```typescript
const todos = await blink.db.todos.list({
  where: {
    // SQLite boolean as string "0" or "1"
    isCompleted: "0" 
  },
  orderBy: { createdAt: 'desc' },
  limit: 20
})
```

### Update
```typescript
await blink.db.todos.update(todo.id, { isCompleted: true })
```

### Delete
```typescript
await blink.db.todos.delete(todo.id)
```

## AI Operations

### Text Generation
```typescript
const { text } = await blink.ai.generateText({
  prompt: 'Write a summary of the latest tech news',
  maxTokens: 500
})
```

### Text with Web Search
```typescript
const { text, sources } = await blink.ai.generateText({
  prompt: 'Who won the latest Super Bowl?',
  search: true
})
```

### Image Generation
```typescript
const { data } = await blink.ai.generateImage({
  prompt: 'A futuristic city skyline at sunset'
})
console.log(data[0].url)
```

### Vision (Image Analysis)
```typescript
const { text } = await blink.ai.generateText({
  messages: [
    { 
      role: "user", 
      content: [
        { type: "text", text: "Describe this image" },
        { type: "image", image: "https://example.com/image.jpg" }
      ]
    }
  ]
})
```

### Speech & Transcription
```typescript
// Generate Speech
const { url } = await blink.ai.generateSpeech({
  text: 'Hello, world!',
  voice: 'nova'
})

// Transcribe Audio (from URL)
const { text } = await blink.ai.transcribeAudio({
  audio: 'https://example.com/audio/meeting.mp3',
  language: 'en'
})
```

## Data Operations

### Web Search
```typescript
// General search
const results = await blink.data.search("latest ai news", { type: 'news' })

// Local search
const local = await blink.data.search("pizza", { location: "New York, NY" })
```

### Web Scraping
```typescript
const { markdown, metadata } = await blink.data.scrape("https://example.com")
```

### Secure API Fetch
Use this to call external APIs without exposing secrets (configure secrets in Blink dashboard).

```typescript
const response = await blink.data.fetch({
  url: "https://api.openai.com/v1/chat/completions",
  method: "POST",
  headers: { "Authorization": "Bearer {{openai_api_key}}" },
  body: { model: "gpt-4", messages: [] }
})
```

## Storage Operations

### Upload File
```typescript
const { publicUrl } = await blink.storage.upload(
  fileObject,
  // Always extract extension, don't hardcode
  `uploads/${Date.now()}.${fileObject.name.split('.').pop()}`,
  { upsert: true }
)
```

### Delete File
```typescript
await blink.storage.remove('uploads/file1.jpg')
```

## Notifications

### Send Email
```typescript
const { success } = await blink.notifications.email({
  to: 'user@example.com',
  subject: 'Welcome!',
  html: '<h1>Welcome to the platform</h1>',
  text: 'Welcome to the platform'
})
```

## Realtime Operations

### Subscribe to Channel
```typescript
const unsubscribe = await blink.realtime.subscribe('global-chat', (message) => {
  console.log('Received:', message.data)
})
```

### Publish Message
```typescript
await blink.realtime.publish('global-chat', 'message', { 
  text: 'Hello World',
  timestamp: Date.now() 
})
```

### Presence
```typescript
const users = await blink.realtime.presence('global-chat')
console.log('Active users:', users.length)
```

## Analytics Operations

### Log Event
```typescript
blink.analytics.log('feature_used', {
  feature_name: 'image_generation',
  duration: 120
})
```

## Error Handling

Wrap operations in try-catch blocks and handle specific Blink errors.

```typescript
import { 
  BlinkAIError, 
  BlinkDataError, 
  BlinkStorageError, 
  BlinkRealtimeError 
} from '@blinkdotnew/sdk'

try {
  await blink.ai.generateText({ prompt: '...' })
} catch (error) {
  if (error instanceof BlinkAIError) {
    console.error('AI Generation failed:', error.message)
  } else if (error instanceof BlinkDataError) {
    console.error('Data operation failed:', error.message)
  } else {
    console.error('Unknown error:', error)
  }
}
```
