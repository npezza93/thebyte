class RemoveSubtitleFromPosts < ActiveRecord::Migration
  def change
  	remove_column :posts, :subtitle
  end
end
