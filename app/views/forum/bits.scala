package views.html
package forum

import controllers.routes

import lila.app.templating.Environment.{ given, * }
import lila.app.ui.ScalatagsTemplate.{ *, given }
import lila.forum.{ ForumPost, MiniForumPost }
import lila.security.{ Granter, Permission }

object bits:

  def searchForm(search: String = "")(using PageContext) =
    div(cls := "box__top__actions")(
      form(cls := "search", action := routes.ForumPost.search())(
        input(
          name         := "text",
          value        := search,
          placeholder  := trans.search.search.txt(),
          enterkeyhint := "search"
        )
      )
    )

  def recentPosts(forumPosts: List[MiniForumPost])(using PageContext) =
    forumPosts.map: post =>
      div(cls := "post")(
        span()(
          userIdLink(post.userId),
          " in ",
          a(href := routes.ForumPost.redirect(post.postId), title := post.text)(
            shorten(post.topicName, 50)
          )
        ),
        br,
        post.contributors.map: conts =>
          span("+ ", conts.map(cont => userIdLink(cont.some)).join(" · "))
      )

  def authorLink(post: ForumPost, cssClass: Option[String] = None, withOnline: Boolean = true)(using
      PageContext
  ): Frag =
    if !Granter.opt(_.ModerateForum) && post.erased
    then span(cls := "author")("<erased>")
    else userIdLink(post.userId, cssClass = cssClass, withOnline = withOnline, modIcon = ~post.modIcon)

  private[forum] val dataTopic = attr("data-topic")
  private[forum] val dataUnsub = attr("data-unsub")
