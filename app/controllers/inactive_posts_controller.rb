class InactivePostsController < ApplicationController
  def index
    @posts = Post.order('created_at DESC').where(status:false).paginate(page: params[:page], per_page: 22)
    @page_number = params[:page]
    respond_to do |format|
      format.html
      format.js
    end
  end
end