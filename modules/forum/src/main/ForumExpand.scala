package lila.forum

import scalatags.Text.all.{ raw, Frag }

import lila.base.RawHtml
import lila.common.config

final class ForumTextExpand(askApi: lila.ask.AskApi)(using Executor, Scheduler):

  private def one(post: ForumPost)(using config.NetDomain): Fu[ForumPost.WithFrag] =
    lila.common.Bus
      .ask("lpv")(lila.hub.actorApi.lpv.LpvLinkRenderFromText(post.text, _))
      .map: linkRender =>
        raw:
          RawHtml.nl2br {
            RawHtml.addLinks(post.text, expandImg = true, linkRender = linkRender.some).value
          }.value
      .zip(askApi.asksIn(post.text))
      .map: (body, asks) =>
        ForumPost.WithFrag(post, body, asks)

  def manyPosts(posts: Seq[ForumPost])(using config.NetDomain): Fu[Seq[ForumPost.WithFrag]] =
    posts.traverse(one)
