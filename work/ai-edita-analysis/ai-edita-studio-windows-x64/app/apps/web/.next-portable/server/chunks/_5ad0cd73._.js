module.exports=[838014,(e,t,i)=>{"use strict";var n=Object.defineProperty,r=Object.getOwnPropertyDescriptor,a=Object.getOwnPropertyNames,s=Object.prototype.hasOwnProperty,l={},o={Analytics:()=>h};for(var c in o)n(l,c,{get:o[c],enumerable:!0});t.exports=((e,t,i,l)=>{if(t&&"object"==typeof t||"function"==typeof t)for(let i of a(t))s.call(e,i)||void 0===i||n(e,i,{get:()=>t[i],enumerable:!(l=r(t,i))||l.enumerable});return e})(n({},"__esModule",{value:!0}),l);var d=`
local key = KEYS[1]
local field = ARGV[1]

local data = redis.call("ZRANGE", key, 0, -1, "WITHSCORES")
local count = {}

for i = 1, #data, 2 do
  local json_str = data[i]
  local score = tonumber(data[i + 1])
  local obj = cjson.decode(json_str)

  local fieldValue = obj[field]

  if count[fieldValue] == nil then
    count[fieldValue] = score
  else
    count[fieldValue] = count[fieldValue] + score
  end
end

local result = {}
for k, v in pairs(count) do
  table.insert(result, {k, v})
end

return result
`,u=`
local prefix = KEYS[1]
local first_timestamp = tonumber(ARGV[1]) -- First timestamp to check
local increment = tonumber(ARGV[2])       -- Increment between each timestamp
local num_timestamps = tonumber(ARGV[3])  -- Number of timestampts to check (24 for a day and 24 * 7 for a week)
local num_elements = tonumber(ARGV[4])    -- Number of elements to fetch in each category
local check_at_most = tonumber(ARGV[5])   -- Number of elements to check at most.

local keys = {}
for i = 1, num_timestamps do
  local timestamp = first_timestamp - (i - 1) * increment
  table.insert(keys, prefix .. ":" .. timestamp)
end

-- get the union of the groups
local zunion_params = {"ZUNION", num_timestamps, unpack(keys)}
table.insert(zunion_params, "WITHSCORES")
local result = redis.call(unpack(zunion_params))

-- select num_elements many items
local true_group = {}
local false_group = {}
local denied_group = {}
local true_count = 0
local false_count = 0
local denied_count = 0
local i = #result - 1

-- index to stop at after going through "checkAtMost" many items:
local cutoff_index = #result - 2 * check_at_most

-- iterate over the results
while (true_count + false_count + denied_count) < (num_elements * 3) and 1 <= i and i >= cutoff_index do
  local score = tonumber(result[i + 1])
  if score > 0 then
    local element = result[i]
    if string.find(element, "success\\":true") and true_count < num_elements then
      table.insert(true_group, {score, element})
      true_count = true_count + 1
    elseif string.find(element, "success\\":false") and false_count < num_elements then
      table.insert(false_group, {score, element})
      false_count = false_count + 1
    elseif string.find(element, "success\\":\\"denied") and denied_count < num_elements then
      table.insert(denied_group, {score, element})
      denied_count = denied_count + 1
    end
  end
  i = i - 2
end

return {true_group, false_group, denied_group}
`,m=`
local prefix = KEYS[1]
local first_timestamp = tonumber(ARGV[1])
local increment = tonumber(ARGV[2])
local num_timestamps = tonumber(ARGV[3])

local keys = {}
for i = 1, num_timestamps do
  local timestamp = first_timestamp - (i - 1) * increment
  table.insert(keys, prefix .. ":" .. timestamp)
end

-- get the union of the groups
local zunion_params = {"ZUNION", num_timestamps, unpack(keys)}
table.insert(zunion_params, "WITHSCORES")
local result = redis.call(unpack(zunion_params))

return result
`,h=class{redis;prefix;bucketSize;constructor(e){this.redis=e.redis,this.prefix=e.prefix??"@upstash/analytics",this.bucketSize=this.parseWindow(e.window)}validateTableName(e){if(!/^[a-zA-Z0-9_-]+$/.test(e))throw Error(`Invalid table name: ${e}. Table names can only contain letters, numbers, dashes and underscores.`)}parseWindow(e){if("number"==typeof e){if(e<=0)throw Error(`Invalid window: ${e}`);return e}let t=/^(\d+)([smhd])$/;if(!t.test(e))throw Error(`Invalid window: ${e}`);let[,i,n]=e.match(t),r=parseInt(i);switch(n){case"s":return 1e3*r;case"m":return 1e3*r*60;case"h":return 1e3*r*3600;case"d":return 1e3*r*86400;default:throw Error(`Invalid window unit: ${n}`)}}getBucket(e){return Math.floor((e??Date.now())/this.bucketSize)*this.bucketSize}async ingest(e,...t){this.validateTableName(e),await Promise.all(t.map(async t=>{let i=this.getBucket(t.time),n=[this.prefix,e,i].join(":");await this.redis.zincrby(n,1,JSON.stringify({...t,time:void 0}))}))}formatBucketAggregate(e,t,i){let n={};return e.forEach(([e,i])=>{"success"==t&&(e=1===e?"true":null===e?"false":e),n[t]=n[t]||{},n[t][(e??"null").toString()]=i}),{time:i,...n}}async aggregateBucket(e,t,i){this.validateTableName(e);let n=this.getBucket(i),r=[this.prefix,e,n].join(":"),a=await this.redis.eval(d,[r],[t]);return this.formatBucketAggregate(a,t,n)}async aggregateBuckets(e,t,i,n){this.validateTableName(e);let r=this.getBucket(n),a=[];for(let n=0;n<i;n+=1)a.push(this.aggregateBucket(e,t,r)),r-=this.bucketSize;return Promise.all(a)}async aggregateBucketsWithPipeline(e,t,i,n,r){this.validateTableName(e),r=r??48;let a=this.getBucket(n),s=[],l=this.redis.pipeline(),o=[];for(let n=1;n<=i;n+=1){let c=[this.prefix,e,a].join(":");l.eval(d,[c],[t]),s.push(a),a-=this.bucketSize,(n%r==0||n==i)&&(o.push(l.exec()),l=this.redis.pipeline())}return(await Promise.all(o)).flat().map((e,i)=>this.formatBucketAggregate(e,t,s[i]))}async getAllowedBlocked(e,t,i){this.validateTableName(e);let n=[this.prefix,e].join(":"),r=this.getBucket(i),a=await this.redis.eval(m,[n],[r,this.bucketSize,t]),s={};for(let e=0;e<a.length;e+=2){let t=a[e],i=t.identifier,n=+a[e+1];s[i]||(s[i]={success:0,blocked:0}),s[i][t.success?"success":"blocked"]=n}return s}async getMostAllowedBlocked(e,t,i,n,r){this.validateTableName(e);let a=[this.prefix,e].join(":"),s=this.getBucket(n),[l,o,c]=await this.redis.eval(u,[a],[s,this.bucketSize,t,i,r??5*i]);return{allowed:this.toDicts(l),ratelimited:this.toDicts(o),denied:this.toDicts(c)}}toDicts(e){let t=[];for(let i=0;i<e.length;i+=1){let n=+e[i][0],r=e[i][1];t.push({identifier:r.identifier,count:n})}return t}}},331641,(e,t,i)=>{"use strict";var n=Object.defineProperty,r=Object.getOwnPropertyDescriptor,a=Object.getOwnPropertyNames,s=Object.prototype.hasOwnProperty,l=(e,t)=>{for(var i in t)n(e,i,{get:t[i],enumerable:!0})},o={};l(o,{Analytics:()=>d,IpDenyList:()=>x,MultiRegionRatelimit:()=>W,Ratelimit:()=>B}),t.exports=((e,t,i,l)=>{if(t&&"object"==typeof t||"function"==typeof t)for(let i of a(t))s.call(e,i)||void 0===i||n(e,i,{get:()=>t[i],enumerable:!(l=r(t,i))||l.enumerable});return e})(n({},"__esModule",{value:!0}),o);var c=e.r(838014),d=class{analytics;table="events";constructor(e){this.analytics=new c.Analytics({redis:e.redis,window:"1h",prefix:e.prefix??"@upstash/ratelimit",retention:"90d"})}extractGeo(e){return void 0!==e.geo?e.geo:void 0!==e.cf?e.cf:{}}async record(e){await this.analytics.ingest(this.table,e)}async series(e,t){let i=Math.min((this.analytics.getBucket(Date.now())-this.analytics.getBucket(t))/36e5,256);return this.analytics.aggregateBucketsWithPipeline(this.table,e,i)}async getUsage(e=0){let t=Math.min((this.analytics.getBucket(Date.now())-this.analytics.getBucket(e))/36e5,256);return await this.analytics.getAllowedBlocked(this.table,t)}async getUsageOverTime(e,t){return await this.analytics.aggregateBucketsWithPipeline(this.table,t,e)}async getMostAllowedBlocked(e,t,i){return t=t??5,this.analytics.getMostAllowedBlocked(this.table,e,t,void 0,i)}},u=class{cache;constructor(e){this.cache=e}isBlocked(e){if(!this.cache.has(e))return{blocked:!1,reset:0};let t=this.cache.get(e);return t<Date.now()?(this.cache.delete(e),{blocked:!1,reset:0}):{blocked:!0,reset:t}}blockUntil(e,t){this.cache.set(e,t)}set(e,t){this.cache.set(e,t)}get(e){return this.cache.get(e)||null}incr(e,t=1){let i=this.cache.get(e)??0;return i+=t,this.cache.set(e,i),i}pop(e){this.cache.delete(e)}empty(){this.cache.clear()}size(){return this.cache.size}},m=":dynamic:global",h="@upstash/ratelimit";function f(e){let t=e.match(/^(\d+)\s?(ms|s|m|h|d)$/);if(!t)throw Error(`Unable to parse window size: ${e}`);let i=Number.parseInt(t[1]);switch(t[2]){case"ms":return i;case"s":return 1e3*i;case"m":return 1e3*i*60;case"h":return 1e3*i*3600;case"d":return 1e3*i*86400;default:throw Error(`Unable to parse window size: ${e}`)}}var y=async(e,t,i,n)=>{try{return await e.redis.evalsha(t.hash,i,n)}catch(r){if(`${r}`.includes("NOSCRIPT"))return await e.redis.eval(t.script,i,n);throw r}},p={fixedWindow:{limit:{script:`
  local key           = KEYS[1]
  local dynamicLimitKey = KEYS[2]  -- optional: key for dynamic limit in redis
  local tokens        = tonumber(ARGV[1])  -- default limit
  local window        = ARGV[2]
  local incrementBy   = ARGV[3] -- increment rate per request at a given value, default is 1

  -- Check for dynamic limit
  local effectiveLimit = tokens
  if dynamicLimitKey ~= "" then
    local dynamicLimit = redis.call("GET", dynamicLimitKey)
    if dynamicLimit then
      effectiveLimit = tonumber(dynamicLimit)
    end
  end

  local r = redis.call("INCRBY", key, incrementBy)
  if r == tonumber(incrementBy) then
  -- The first time this key is set, the value will be equal to incrementBy.
  -- So we only need the expire command once
  redis.call("PEXPIRE", key, window)
  end

  return {r, effectiveLimit}
`,hash:"472e55443b62f60d0991028456c57815a387066d"},getRemaining:{script:`
  local key = KEYS[1]
  local dynamicLimitKey = KEYS[2]  -- optional: key for dynamic limit in redis
  local tokens = tonumber(ARGV[1])  -- default limit

  -- Check for dynamic limit
  local effectiveLimit = tokens
  if dynamicLimitKey ~= "" then
    local dynamicLimit = redis.call("GET", dynamicLimitKey)
    if dynamicLimit then
      effectiveLimit = tonumber(dynamicLimit)
    end
  end

  local value = redis.call('GET', key)
  local usedTokens = 0
  if value then
    usedTokens = tonumber(value)
  end
  
  return {effectiveLimit - usedTokens, effectiveLimit}
`,hash:"40515c9dd0a08f8584f5f9b593935f6a87c1c1c3"}},slidingWindow:{limit:{script:`
  local currentKey  = KEYS[1]           -- identifier including prefixes
  local previousKey = KEYS[2]           -- key of the previous bucket
  local dynamicLimitKey = KEYS[3]       -- optional: key for dynamic limit in redis
  local tokens      = tonumber(ARGV[1]) -- default tokens per window
  local now         = ARGV[2]           -- current timestamp in milliseconds
  local window      = ARGV[3]           -- interval in milliseconds
  local incrementBy = tonumber(ARGV[4]) -- increment rate per request at a given value, default is 1

  -- Check for dynamic limit
  local effectiveLimit = tokens
  if dynamicLimitKey ~= "" then
    local dynamicLimit = redis.call("GET", dynamicLimitKey)
    if dynamicLimit then
      effectiveLimit = tonumber(dynamicLimit)
    end
  end

  local requestsInCurrentWindow = redis.call("GET", currentKey)
  if requestsInCurrentWindow == false then
    requestsInCurrentWindow = 0
  end

  local requestsInPreviousWindow = redis.call("GET", previousKey)
  if requestsInPreviousWindow == false then
    requestsInPreviousWindow = 0
  end
  local percentageInCurrent = ( now % window ) / window
  -- weighted requests to consider from the previous window
  requestsInPreviousWindow = math.floor(( 1 - percentageInCurrent ) * requestsInPreviousWindow)

  -- Only check limit if not refunding (negative rate)
  if incrementBy > 0 and requestsInPreviousWindow + requestsInCurrentWindow >= effectiveLimit then
    return {-1, effectiveLimit}
  end

  local newValue = redis.call("INCRBY", currentKey, incrementBy)
  if newValue == incrementBy then
    -- The first time this key is set, the value will be equal to incrementBy.
    -- So we only need the expire command once
    redis.call("PEXPIRE", currentKey, window * 2 + 1000) -- Enough time to overlap with a new window + 1 second
  end
  return {effectiveLimit - ( newValue + requestsInPreviousWindow ), effectiveLimit}
`,hash:"977fb636fb5ceb7e98a96d1b3a1272ba018efdae"},getRemaining:{script:`
  local currentKey  = KEYS[1]           -- identifier including prefixes
  local previousKey = KEYS[2]           -- key of the previous bucket
  local dynamicLimitKey = KEYS[3]       -- optional: key for dynamic limit in redis
  local tokens      = tonumber(ARGV[1]) -- default tokens per window
  local now         = ARGV[2]           -- current timestamp in milliseconds
  local window      = ARGV[3]           -- interval in milliseconds

  -- Check for dynamic limit
  local effectiveLimit = tokens
  if dynamicLimitKey ~= "" then
    local dynamicLimit = redis.call("GET", dynamicLimitKey)
    if dynamicLimit then
      effectiveLimit = tonumber(dynamicLimit)
    end
  end

  local requestsInCurrentWindow = redis.call("GET", currentKey)
  if requestsInCurrentWindow == false then
    requestsInCurrentWindow = 0
  end

  local requestsInPreviousWindow = redis.call("GET", previousKey)
  if requestsInPreviousWindow == false then
    requestsInPreviousWindow = 0
  end

  local percentageInCurrent = ( now % window ) / window
  -- weighted requests to consider from the previous window
  requestsInPreviousWindow = math.floor(( 1 - percentageInCurrent ) * requestsInPreviousWindow)

  local usedTokens = requestsInPreviousWindow + requestsInCurrentWindow
  return {effectiveLimit - usedTokens, effectiveLimit}
`,hash:"ee3a3265fad822f83acad23f8a1e2f5c0b156b03"}},tokenBucket:{limit:{script:`
  local key         = KEYS[1]           -- identifier including prefixes
  local dynamicLimitKey = KEYS[2]       -- optional: key for dynamic limit in redis
  local maxTokens   = tonumber(ARGV[1]) -- default maximum number of tokens
  local interval    = tonumber(ARGV[2]) -- size of the window in milliseconds
  local refillRate  = tonumber(ARGV[3]) -- how many tokens are refilled after each interval
  local now         = tonumber(ARGV[4]) -- current timestamp in milliseconds
  local incrementBy = tonumber(ARGV[5]) -- how many tokens to consume, default is 1

  -- Check for dynamic limit
  local effectiveLimit = maxTokens
  if dynamicLimitKey ~= "" then
    local dynamicLimit = redis.call("GET", dynamicLimitKey)
    if dynamicLimit then
      effectiveLimit = tonumber(dynamicLimit)
    end
  end
        
  local bucket = redis.call("HMGET", key, "refilledAt", "tokens")
        
  local refilledAt
  local tokens

  if bucket[1] == false then
    refilledAt = now
    tokens = effectiveLimit
  else
    refilledAt = tonumber(bucket[1])
    tokens = tonumber(bucket[2])
  end
        
  if now >= refilledAt + interval then
    local numRefills = math.floor((now - refilledAt) / interval)
    tokens = math.min(effectiveLimit, tokens + numRefills * refillRate)

    refilledAt = refilledAt + numRefills * interval
  end

  -- Only reject if tokens are 0 and we're consuming (not refunding)
  if tokens == 0 and incrementBy > 0 then
    return {-1, refilledAt + interval, effectiveLimit}
  end

  local remaining = tokens - incrementBy
  local expireAt = math.ceil(((effectiveLimit - remaining) / refillRate)) * interval
        
  redis.call("HSET", key, "refilledAt", refilledAt, "tokens", remaining)

  if (expireAt > 0) then
    redis.call("PEXPIRE", key, expireAt)
  end
  return {remaining, refilledAt + interval, effectiveLimit}
`,hash:"b35c5bc0b7fdae7dd0573d4529911cabaf9d1d89"},getRemaining:{script:`
  local key         = KEYS[1]
  local dynamicLimitKey = KEYS[2]       -- optional: key for dynamic limit in redis
  local maxTokens   = tonumber(ARGV[1]) -- default maximum number of tokens

  -- Check for dynamic limit
  local effectiveLimit = maxTokens
  if dynamicLimitKey ~= "" then
    local dynamicLimit = redis.call("GET", dynamicLimitKey)
    if dynamicLimit then
      effectiveLimit = tonumber(dynamicLimit)
    end
  end
        
  local bucket = redis.call("HMGET", key, "refilledAt", "tokens")

  if bucket[1] == false then
    return {effectiveLimit, -1, effectiveLimit}
  end
        
  return {tonumber(bucket[2]), tonumber(bucket[1]), effectiveLimit}
`,hash:"deb03663e8af5a968deee895dd081be553d2611b"}},cachedFixedWindow:{limit:{script:`
  local key     = KEYS[1]
  local window  = ARGV[1]
  local incrementBy   = ARGV[2] -- increment rate per request at a given value, default is 1

  local r = redis.call("INCRBY", key, incrementBy)
  if r == incrementBy then
  -- The first time this key is set, the value will be equal to incrementBy.
  -- So we only need the expire command once
  redis.call("PEXPIRE", key, window)
  end
      
  return r
`,hash:"c26b12703dd137939b9a69a3a9b18e906a2d940f"},getRemaining:{script:`
  local key = KEYS[1]
  local tokens = 0

  local value = redis.call('GET', key)
  if value then
      tokens = value
  end
  return tokens
`,hash:"8e8f222ccae68b595ee6e3f3bf2199629a62b91a"}}},w={fixedWindow:{limit:{script:`
	local key           = KEYS[1]
	local id            = ARGV[1]
	local window        = ARGV[2]
	local incrementBy   = tonumber(ARGV[3])

	redis.call("HSET", key, id, incrementBy)
	local fields = redis.call("HGETALL", key)
	if #fields == 2 and tonumber(fields[2])==incrementBy then
	-- The first time this key is set, and the value will be equal to incrementBy.
	-- So we only need the expire command once
	  redis.call("PEXPIRE", key, window)
	end

	return fields
`,hash:"a8c14f3835aa87bd70e5e2116081b81664abcf5c"},getRemaining:{script:`
      local key = KEYS[1]
      local tokens = 0

      local fields = redis.call("HGETALL", key)

      return fields
    `,hash:"8ab8322d0ed5fe5ac8eb08f0c2e4557f1b4816fd"}},slidingWindow:{limit:{script:`
	local currentKey    = KEYS[1]           -- identifier including prefixes
	local previousKey   = KEYS[2]           -- key of the previous bucket
	local tokens        = tonumber(ARGV[1]) -- tokens per window
	local now           = ARGV[2]           -- current timestamp in milliseconds
	local window        = ARGV[3]           -- interval in milliseconds
	local requestId     = ARGV[4]           -- uuid for this request
	local incrementBy   = tonumber(ARGV[5]) -- custom rate, default is  1

	local currentFields = redis.call("HGETALL", currentKey)
	local requestsInCurrentWindow = 0
	for i = 2, #currentFields, 2 do
	requestsInCurrentWindow = requestsInCurrentWindow + tonumber(currentFields[i])
	end

	local previousFields = redis.call("HGETALL", previousKey)
	local requestsInPreviousWindow = 0
	for i = 2, #previousFields, 2 do
	requestsInPreviousWindow = requestsInPreviousWindow + tonumber(previousFields[i])
	end

	local percentageInCurrent = ( now % window) / window

	-- Only check limit if not refunding (negative rate)
	if incrementBy > 0 and requestsInPreviousWindow * (1 - percentageInCurrent ) + requestsInCurrentWindow + incrementBy > tokens then
	  return {currentFields, previousFields, false}
	end

	redis.call("HSET", currentKey, requestId, incrementBy)

	if requestsInCurrentWindow == 0 then 
	  -- The first time this key is set, the value will be equal to incrementBy.
	  -- So we only need the expire command once
	  redis.call("PEXPIRE", currentKey, window * 2 + 1000) -- Enough time to overlap with a new window + 1 second
	end
	return {currentFields, previousFields, true}
`,hash:"1e7ca8dcd2d600a6d0124a67a57ea225ed62921b"},getRemaining:{script:`
	local currentKey    = KEYS[1]           -- identifier including prefixes
	local previousKey   = KEYS[2]           -- key of the previous bucket
	local now         	= ARGV[1]           -- current timestamp in milliseconds
  	local window      	= ARGV[2]           -- interval in milliseconds

	local currentFields = redis.call("HGETALL", currentKey)
	local requestsInCurrentWindow = 0
	for i = 2, #currentFields, 2 do
	requestsInCurrentWindow = requestsInCurrentWindow + tonumber(currentFields[i])
	end

	local previousFields = redis.call("HGETALL", previousKey)
	local requestsInPreviousWindow = 0
	for i = 2, #previousFields, 2 do
	requestsInPreviousWindow = requestsInPreviousWindow + tonumber(previousFields[i])
	end

	local percentageInCurrent = ( now % window) / window
  	requestsInPreviousWindow = math.floor(( 1 - percentageInCurrent ) * requestsInPreviousWindow)
	
	return requestsInCurrentWindow + requestsInPreviousWindow
`,hash:"558c9306b7ec54abb50747fe0b17e5d44bd24868"}}},g={script:`
      local pattern = KEYS[1]

      -- Initialize cursor to start from 0
      local cursor = "0"

      repeat
          -- Scan for keys matching the pattern
          local scan_result = redis.call('SCAN', cursor, 'MATCH', pattern)

          -- Extract cursor for the next iteration
          cursor = scan_result[1]

          -- Extract keys from the scan result
          local keys = scan_result[2]

          for i=1, #keys do
          redis.call('DEL', keys[i])
          end

      -- Continue scanning until cursor is 0 (end of keyspace)
      until cursor == "0"
    `,hash:"54bd274ddc59fb3be0f42deee2f64322a10e2b50"},b="denyList",k="ipDenyList",v="ipDenyListStatus",L=`
  -- Checks if values provideed in ARGV are present in the deny lists.
  -- This is done using the allDenyListsKey below.

  -- Additionally, checks the status of the ip deny list using the
  -- ipDenyListStatusKey below. Here are the possible states of the
  -- ipDenyListStatusKey key:
  -- * status == -1: set to "disabled" with no TTL
  -- * status == -2: not set, meaning that is was set before but expired
  -- * status  >  0: set to "valid", with a TTL
  --
  -- In the case of status == -2, we set the status to "pending" with
  -- 30 second ttl. During this time, the process which got status == -2
  -- will update the ip deny list.

  local allDenyListsKey     = KEYS[1]
  local ipDenyListStatusKey = KEYS[2]

  local results = redis.call('SMISMEMBER', allDenyListsKey, unpack(ARGV))
  local status  = redis.call('TTL', ipDenyListStatusKey)
  if status == -2 then
    redis.call('SETEX', ipDenyListStatusKey, 30, "pending")
  end

  return { results, status }
`,x={};l(x,{ThresholdError:()=>R,disableIpDenyList:()=>I,updateIpDenyList:()=>T});var R=class extends Error{constructor(e){super(`Allowed threshold values are from 1 to 8, 1 and 8 included. Received: ${e}`),this.name="ThresholdError"}},E=async e=>{if("number"!=typeof e||e<1||e>8)throw new R(e);try{let t=await fetch(`https://raw.githubusercontent.com/stamparm/ipsum/master/levels/${e}.txt`);if(!t.ok)throw Error(`Error fetching data: ${t.statusText}`);return(await t.text()).split("\n").filter(e=>e.length>0)}catch(e){throw Error(`Failed to fetch ip deny list: ${e}`)}},T=async(e,t,i,n)=>{let r=await E(i),a=[t,b,"all"].join(":"),s=[t,b,k].join(":"),l=[t,v].join(":"),o=e.multi();return o.sdiffstore(a,a,s),o.del(s),o.sadd(s,r.at(0),...r.slice(1)),o.sdiffstore(s,s,a),o.sunionstore(a,a,s),o.set(l,"valid",{px:n??864e5-(Date.now()-72e5)%864e5}),await o.exec()},I=async(e,t)=>{let i=[t,b,"all"].join(":"),n=[t,b,k].join(":"),r=[t,v].join(":"),a=e.multi();return a.sdiffstore(i,i,n),a.del(n),a.set(r,"disabled"),await a.exec()},A=new u(new Map),P=async(e,t,i)=>{let n,[r,a]=await e.eval(L,[[t,b,"all"].join(":"),[t,v].join(":")],i);return r.map((e,t)=>{if(e){var r;r=i[t],A.size()>1e3&&A.empty(),A.blockUntil(r,Date.now()+6e4),n=i[t]}}),{deniedValue:n,invalidIpDenyList:-2===a}},K=class{limiter;ctx;prefix;timeout;primaryRedis;analytics;enableProtection;denyListThreshold;dynamicLimits;constructor(e){this.ctx=e.ctx,this.limiter=e.limiter,this.timeout=e.timeout??5e3,this.prefix=e.prefix??h,this.dynamicLimits=e.dynamicLimits??!1,this.enableProtection=e.enableProtection??!1,this.denyListThreshold=e.denyListThreshold??6,this.primaryRedis="redis"in this.ctx?this.ctx.redis:this.ctx.regionContexts[0].redis,"redis"in this.ctx&&(this.ctx.dynamicLimits=this.dynamicLimits,this.ctx.prefix=this.prefix),this.analytics=e.analytics?new d({redis:this.primaryRedis,prefix:this.prefix}):void 0,e.ephemeralCache instanceof Map?this.ctx.cache=new u(e.ephemeralCache):void 0===e.ephemeralCache&&(this.ctx.cache=new u(new Map))}limit=async(e,t)=>{let i=null;try{let n=this.getRatelimitResponse(e,t),{responseArray:r,newTimeoutId:a}=this.applyTimeout(n);i=a;let s=await Promise.race(r);return this.submitAnalytics(s,e,t)}finally{i&&clearTimeout(i)}};blockUntilReady=async(e,t)=>{let i;if(t<=0)throw Error("timeout must be positive");let n=Date.now()+t;for(;!(i=await this.limit(e)).success;){if(0===i.reset)throw Error("This should not happen");let e=Math.min(i.reset,n)-Date.now();if(await new Promise(t=>setTimeout(t,e)),Date.now()>n)break}return i};resetUsedTokens=async e=>{let t=[this.prefix,e].join(":");await this.limiter().resetTokens(this.ctx,t)};getRemaining=async e=>{let t=[this.prefix,e].join(":");return await this.limiter().getRemaining(this.ctx,t)};getRatelimitResponse=async(e,t)=>{let i=this.getKey(e),n=this.getDefinedMembers(e,t),r=n.find(e=>A.isBlocked(e).blocked),a=r?[{success:!1,limit:0,remaining:0,reset:0,pending:Promise.resolve(),reason:"denyList",deniedValue:r},{deniedValue:r,invalidIpDenyList:!1}]:await Promise.all([this.limiter().limit(this.ctx,i,t?.rate),this.enableProtection?P(this.primaryRedis,this.prefix,n):{deniedValue:void 0,invalidIpDenyList:!1}]);return((e,t,[i,n],r)=>{if(n.deniedValue&&(i.success=!1,i.remaining=0,i.reason="denyList",i.deniedValue=n.deniedValue),n.invalidIpDenyList){let n=T(e,t,r);i.pending=Promise.all([i.pending,n])}return i})(this.primaryRedis,this.prefix,a,this.denyListThreshold)};applyTimeout=e=>{let t=null,i=[e];if(this.timeout>0){let e=new Promise(e=>{t=setTimeout(()=>{e({success:!0,limit:0,remaining:0,reset:0,pending:Promise.resolve(),reason:"timeout"})},this.timeout)});i.push(e)}return{responseArray:i,newTimeoutId:t}};submitAnalytics=(e,t,i)=>{if(this.analytics)try{let n=i?this.analytics.extractGeo(i):void 0,r=this.analytics.record({identifier:"denyList"===e.reason?e.deniedValue:t,time:Date.now(),success:"denyList"===e.reason?"denied":e.success,...n}).catch(e=>{let t="Failed to record analytics";`${e}`.includes("WRONGTYPE")&&(t=`
    Failed to record analytics. See the information below:

    This can occur when you uprade to Ratelimit version 1.1.2
    or later from an earlier version.

    This occurs simply because the way we store analytics data
    has changed. To avoid getting this error, disable analytics
    for *an hour*, then simply enable it back.

    `),console.warn(t,e)});e.pending=Promise.all([e.pending,r])}catch(e){console.warn("Failed to record analytics",e)}return e};getKey=e=>[this.prefix,e].join(":");getDefinedMembers=(e,t)=>[e,t?.ip,t?.userAgent,t?.country].filter(Boolean);setDynamicLimit=async e=>{if(!this.dynamicLimits)throw Error("dynamicLimits must be enabled in the Ratelimit constructor to use setDynamicLimit()");let t=`${this.prefix}${m}`;await (!1===e.limit?this.primaryRedis.del(t):this.primaryRedis.set(t,e.limit))};getDynamicLimit=async()=>{if(!this.dynamicLimits)throw Error("dynamicLimits must be enabled in the Ratelimit constructor to use getDynamicLimit()");let e=`${this.prefix}${m}`,t=await this.primaryRedis.get(e);return{dynamicLimit:null===t?null:Number(t)}}};function S(){let e="",t="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",i=t.length;for(let n=0;n<16;n++)e+=t.charAt(Math.floor(Math.random()*i));return e}var W=class extends K{constructor(e){super({prefix:e.prefix,limiter:e.limiter,timeout:e.timeout,analytics:e.analytics,dynamicLimits:e.dynamicLimits,ctx:{regionContexts:e.redis.map(t=>({redis:t,prefix:e.prefix??h})),cache:e.ephemeralCache?new u(e.ephemeralCache):void 0}}),e.dynamicLimits&&console.warn("Warning: Dynamic limits are not yet supported for multi-region rate limiters. The dynamicLimits option will be ignored.")}static fixedWindow(e,t){let i=f(t);return()=>({async limit(t,n,r){let a=S(),s=Math.floor(Date.now()/i),l=[n,s].join(":"),o=r??1;if(t.cache&&o>0){let{blocked:i,reset:r}=t.cache.isBlocked(n);if(i)return{success:!1,limit:e,remaining:0,reset:r,pending:Promise.resolve(),reason:"cacheBlock"}}let c=t.regionContexts.map(e=>({redis:e.redis,request:y(e,w.fixedWindow.limit,[l],[a,i,o])})),d=e-(await Promise.any(c.map(e=>e.request))).reduce((e,t,i)=>{let n=0;return i%2&&(n=Number.parseInt(t)),e+n},0);async function u(){let t=[...new Set((await Promise.all(c.map(e=>e.request))).flat().reduce((e,t,i)=>(i%2==0&&e.push(t),e),[])).values()];for(let i of c){let n=(await i.request).reduce((e,t,i)=>{let n=0;return i%2&&(n=Number.parseInt(t)),e+n},0),r=(await i.request).reduce((e,t,i)=>(i%2==0&&e.push(t),e),[]);if(n>=e)continue;let a=t.filter(e=>!r.includes(e));if(0!==a.length)for(let e of a)await i.redis.hset(l,{[e]:o})}}let m=d>=0,h=(s+1)*i;return t.cache&&(m?o<0&&t.cache.pop(n):t.cache.blockUntil(n,h)),{success:m,limit:e,remaining:d,reset:h,pending:u()}},async getRemaining(t,n){let r=Math.floor(Date.now()/i),a=[n,r].join(":"),s=t.regionContexts.map(e=>({redis:e.redis,request:y(e,w.fixedWindow.getRemaining,[a],[null])}));return{remaining:Math.max(0,e-(await Promise.any(s.map(e=>e.request))).reduce((e,t,i)=>{let n=0;return i%2&&(n=Number.parseInt(t)),e+n},0)),reset:(r+1)*i,limit:e}},async resetTokens(e,t){let i=[t,"*"].join(":");e.cache&&e.cache.pop(t),await Promise.all(e.regionContexts.map(e=>{y(e,g,[i],[null])}))}})}static slidingWindow(e,t){let i=f(t),n=f(t);return()=>({async limit(t,r,a){let s=S(),l=Date.now(),o=Math.floor(l/i),c=[r,o].join(":"),d=[r,o-1].join(":"),u=a??1;if(t.cache&&u>0){let{blocked:i,reset:n}=t.cache.isBlocked(r);if(i)return{success:!1,limit:e,remaining:0,reset:n,pending:Promise.resolve(),reason:"cacheBlock"}}let m=t.regionContexts.map(t=>({redis:t.redis,request:y(t,w.slidingWindow.limit,[c,d],[e,l,n,s,u])})),h=l%n/n,[f,p,g]=await Promise.any(m.map(e=>e.request));g&&f.push(s,u.toString());let b=e-(Math.ceil(p.reduce((e,t,i)=>{let n=0;return i%2&&(n=Number.parseInt(t)),e+n},0)*(1-h))+f.reduce((e,t,i)=>{let n=0;return i%2&&(n=Number.parseInt(t)),e+n},0));async function k(){let t=[...new Set((await Promise.all(m.map(e=>e.request))).flatMap(([e])=>e).reduce((e,t,i)=>(i%2==0&&e.push(t),e),[])).values()];for(let i of m){let[n,r,a]=await i.request,s=n.reduce((e,t,i)=>(i%2==0&&e.push(t),e),[]);if(n.reduce((e,t,i)=>{let n=0;return i%2&&(n=Number.parseInt(t)),e+n},0)>=e)continue;let l=t.filter(e=>!s.includes(e));if(0!==l.length)for(let e of l)await i.redis.hset(c,{[e]:u})}}let v=(o+1)*n;return t.cache&&(g?u<0&&t.cache.pop(r):t.cache.blockUntil(r,v)),{success:!!g,limit:e,remaining:Math.max(0,b),reset:v,pending:k()}},async getRemaining(t,n){let r=Date.now(),a=Math.floor(r/i),s=[n,a].join(":"),l=[n,a-1].join(":"),o=t.regionContexts.map(e=>({redis:e.redis,request:y(e,w.slidingWindow.getRemaining,[s,l],[r,i])}));return{remaining:Math.max(0,e-await Promise.any(o.map(e=>e.request))),reset:(a+1)*i,limit:e}},async resetTokens(e,t){let i=[t,"*"].join(":");e.cache&&e.cache.pop(t),await Promise.all(e.regionContexts.map(e=>{y(e,g,[i],[null])}))}})}},B=class extends K{constructor(e){super({prefix:e.prefix,limiter:e.limiter,timeout:e.timeout,analytics:e.analytics,ctx:{redis:e.redis,prefix:e.prefix??h},ephemeralCache:e.ephemeralCache,enableProtection:e.enableProtection,denyListThreshold:e.denyListThreshold,dynamicLimits:e.dynamicLimits})}static fixedWindow(e,t){let i=f(t);return()=>({async limit(t,n,r){let a=Math.floor(Date.now()/i),s=[n,a].join(":"),l=r??1;if(t.cache&&l>0){let{blocked:i,reset:r}=t.cache.isBlocked(n);if(i)return{success:!1,limit:e,remaining:0,reset:r,pending:Promise.resolve(),reason:"cacheBlock"}}let o=t.dynamicLimits?`${t.prefix}${m}`:"",[c,d]=await y(t,p.fixedWindow.limit,[s,o],[e,i,l]),u=c<=d,h=Math.max(0,d-c),f=(a+1)*i;return t.cache&&(u?l<0&&t.cache.pop(n):t.cache.blockUntil(n,f)),{success:u,limit:d,remaining:h,reset:f,pending:Promise.resolve()}},async getRemaining(t,n){let r=Math.floor(Date.now()/i),a=[n,r].join(":"),s=t.dynamicLimits?`${t.prefix}${m}`:"",[l,o]=await y(t,p.fixedWindow.getRemaining,[a,s],[e]);return{remaining:Math.max(0,l),reset:(r+1)*i,limit:o}},async resetTokens(e,t){let i=[t,"*"].join(":");e.cache&&e.cache.pop(t),await y(e,g,[i],[null])}})}static slidingWindow(e,t){let i=f(t);return()=>({async limit(t,n,r){let a=Date.now(),s=Math.floor(a/i),l=[n,s].join(":"),o=[n,s-1].join(":"),c=r??1;if(t.cache&&c>0){let{blocked:i,reset:r}=t.cache.isBlocked(n);if(i)return{success:!1,limit:e,remaining:0,reset:r,pending:Promise.resolve(),reason:"cacheBlock"}}let d=t.dynamicLimits?`${t.prefix}${m}`:"",[u,h]=await y(t,p.slidingWindow.limit,[l,o,d],[e,a,i,c]),f=u>=0,w=(s+1)*i;return t.cache&&(f?c<0&&t.cache.pop(n):t.cache.blockUntil(n,w)),{success:f,limit:h,remaining:Math.max(0,u),reset:w,pending:Promise.resolve()}},async getRemaining(t,n){let r=Date.now(),a=Math.floor(r/i),s=[n,a].join(":"),l=[n,a-1].join(":"),o=t.dynamicLimits?`${t.prefix}${m}`:"",[c,d]=await y(t,p.slidingWindow.getRemaining,[s,l,o],[e,r,i]);return{remaining:Math.max(0,c),reset:(a+1)*i,limit:d}},async resetTokens(e,t){let i=[t,"*"].join(":");e.cache&&e.cache.pop(t),await y(e,g,[i],[null])}})}static tokenBucket(e,t,i){let n=f(t);return()=>({async limit(t,r,a){let s=Date.now(),l=a??1;if(t.cache&&l>0){let{blocked:e,reset:n}=t.cache.isBlocked(r);if(e)return{success:!1,limit:i,remaining:0,reset:n,pending:Promise.resolve(),reason:"cacheBlock"}}let o=t.dynamicLimits?`${t.prefix}${m}`:"",[c,d,u]=await y(t,p.tokenBucket.limit,[r,o],[i,n,e,s,l]),h=c>=0;return t.cache&&(h?l<0&&t.cache.pop(r):t.cache.blockUntil(r,d)),{success:h,limit:u,remaining:Math.max(0,c),reset:d,pending:Promise.resolve()}},async getRemaining(e,t){let r=e.dynamicLimits?`${e.prefix}${m}`:"",[a,s,l]=await y(e,p.tokenBucket.getRemaining,[t,r],[i]),o=Date.now()+n,c=s+n;return{remaining:Math.max(0,a),reset:-1===s?o:c,limit:l}},async resetTokens(e,t){e.cache&&e.cache.pop(t),await y(e,g,[t],[null])}})}static cachedFixedWindow(e,t){let i=f(t);return()=>({async limit(t,n,r){if(!t.cache)throw Error("This algorithm requires a cache");t.dynamicLimits&&console.warn("Warning: Dynamic limits are not yet supported for cachedFixedWindow algorithm. The dynamicLimits option will be ignored.");let a=Math.floor(Date.now()/i),s=[n,a].join(":"),l=(a+1)*i,o=r??1;if("number"==typeof t.cache.get(s)){let n=t.cache.incr(s,o),r=n<e,a=r?y(t,p.cachedFixedWindow.limit,[s],[i,o]):Promise.resolve();return{success:r,limit:e,remaining:e-n,reset:l,pending:a}}let c=await y(t,p.cachedFixedWindow.limit,[s],[i,o]);t.cache.set(s,c);let d=e-c;return{success:d>=0,limit:e,remaining:d,reset:l,pending:Promise.resolve()}},async getRemaining(t,n){if(!t.cache)throw Error("This algorithm requires a cache");let r=Math.floor(Date.now()/i),a=[n,r].join(":");return"number"==typeof t.cache.get(a)?{remaining:Math.max(0,e-(t.cache.get(a)??0)),reset:(r+1)*i,limit:e}:{remaining:Math.max(0,e-await y(t,p.cachedFixedWindow.getRemaining,[a],[null])),reset:(r+1)*i,limit:e}},async resetTokens(e,t){if(!e.cache)throw Error("This algorithm requires a cache");let n=[t,Math.floor(Date.now()/i)].join(":");e.cache.pop(n);let r=[t,"*"].join(":");await y(e,g,[r],[null])}})}}},699093,e=>{"use strict";var t=e.i(331641),i=e.i(105391),n=e.i(234878);let r=new i.Redis({url:n.webEnv.UPSTASH_REDIS_REST_URL,token:n.webEnv.UPSTASH_REDIS_REST_TOKEN}),a=new t.Ratelimit({redis:r,limiter:t.Ratelimit.slidingWindow(100,"1 m"),analytics:!0,prefix:"rate-limit"});async function s({request:e}){let t=e.headers.get("x-forwarded-for")??"anonymous";try{let{success:e}=await a.limit(t);return{success:e,limited:!e}}catch(e){return{success:!0,limited:!1}}}e.s(["checkRateLimit",()=>s])}];

//# sourceMappingURL=_5ad0cd73._.js.map