class ChangePosts < ActiveRecord::Migration
	def change
		change_column :posts, :status, :boolean, default: true
	end
end
