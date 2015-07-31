class CommentsController < ApplicationController
    def create
        @post = Post.find_by_slug(params[:post_id])
        @comment = @post.comments.create!(comment_params)
        @comment.user_id= session[:user_id]
        @comment.save
        respond_to do |format|
	      format.js
	    end
    end
  
  private
    # Never trust parameters from the scary internet, only allow the white list through.
    def comment_params
      params.require(:comment).permit(:body)
    end
end
