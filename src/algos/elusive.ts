import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'
import { AlgoManager } from '../addn/algoManager'
import dotenv from 'dotenv'
import { Post } from '../db/schema'
import dbClient from '../db/dbClient'
import getUserFollows from '../addn/getUserFollows'

dotenv.config()

// max 15 chars
export const shortname = 'baddies'

export const handler = async (ctx: AppContext, params: QueryParams) => {
  const builder = await dbClient.getLatestPostsForTag(
    shortname,
    params.limit,
    params.cursor,
  )

  const imagePosts = builder.filter((row) => {
    // Assuming there's a property like "contentType" that indicates the content type
    // You may need to adjust this condition based on your data model
    return row.contentType === 'image';
  });

  const feed = imagePosts.map((row) => ({
    post: row.uri,
  }));

  let cursor: string | undefined
  const last = imagePosts.at(-1)
  if (last) {
    cursor = `${new Date(last.indexedAt).getTime()}::${last.cid}`
  }

  return {
    cursor,
    feed,
  }
}

export class manager extends AlgoManager {
  public name: string = shortname
  public did = 'did:plc:db645kt5coo7teuoxdjhq34x'
  public follows: string[] = []

  public async periodicTask() {
    this.follows = await getUserFollows(this.did, this.agent)
    await this.db.removeTagFromOldPosts(
      this.name,
      new Date().getTime() - 3 * 24 * 60 * 60 * 1000, //3 days
    )
  }

  public async filter_post(post: Post): Promise<Boolean> {
    if (post.replyRoot !== null) return false
    // getUserFollows is memoised, so this should be fine
    this.follows = await getUserFollows(this.did, this.agent)

    if (this.agent === null) {
      await this.start()
    }
    if (this.agent === null) return false

    return this.follows.includes(post.author)
  }
}
